import {
  ContributionPeriod,
  MembershipStatus,
  PaymentMethod
} from "@beabee/beabee-common";
import { DeepPartial } from "typeorm";

import { getRepository, runTransaction } from "@core/database";
import { log as mainLogger } from "@core/logging";
import { calcRenewalDate } from "@core/utils/payment";

import { PaymentProvider } from "@core/providers/payment";
import GCProvider from "@core/providers/payment/GCProvider";
import ManualProvider from "@core/providers/payment/ManualProvider";
import StripeProvider from "@core/providers/payment/StripeProvider";

import CantUpdateContribution from "@api/errors/CantUpdateContribution";

import Contact from "@models/Contact";
import Payment from "@models/Payment";
import ContactContribution from "@models/ContactContribution";

import {
  CompletedPaymentFlow,
  ContributionInfo,
  PaymentForm,
  UpdateContributionResult
} from "@type/index";

const log = mainLogger.child({ app: "payment-service" });

const PaymentProviders = {
  [PaymentMethod.None]: ManualProvider,
  [PaymentMethod.Manual]: ManualProvider,
  [PaymentMethod.StripeCard]: StripeProvider,
  [PaymentMethod.StripeSEPA]: StripeProvider,
  [PaymentMethod.StripeBACS]: StripeProvider,
  [PaymentMethod.StripePayPal]: StripeProvider,
  [PaymentMethod.GoCardlessDirectDebit]: GCProvider
};

export function getMembershipStatus(contact: Contact): MembershipStatus {
  return contact.membership
    ? contact.membership.isActive
      ? contact.contribution.cancelledAt
        ? MembershipStatus.Expiring
        : MembershipStatus.Active
      : MembershipStatus.Expired
    : MembershipStatus.None;
}

type ProviderFn<T> = (
  provider: PaymentProvider,
  contribution: ContactContribution
) => Promise<T>;

class PaymentService {
  async getContribution(contact: Contact): Promise<ContactContribution> {
    const contribution = await getRepository(
      ContactContribution
    ).findOneByOrFail({
      contactId: contact.id,
      status: "current"
    });
    contribution.contact = contact; // No need to refetch contact, just add it in
    return contribution;
  }

  async getContributionBy(
    key: "customerId" | "mandateId" | "subscriptionId",
    value: string
  ): Promise<ContactContribution | null> {
    return await getRepository(ContactContribution).findOne({
      where: { [key]: value },
      relations: { contact: true },
      order: { createdAt: "DESC" }
    });
  }

  async updateData(contact: Contact, updates: Partial<ContactContribution>) {
    await getRepository(ContactContribution).update(contact.id, updates);
  }

  private async provider(contact: Contact, fn: ProviderFn<void>): Promise<void>;
  private async provider<T>(contact: Contact, fn: ProviderFn<T>): Promise<T>;
  private async provider<T>(contact: Contact, fn: ProviderFn<T>): Promise<T> {
    const contribution = await this.getContribution(contact);
    return await fn(
      new PaymentProviders[contribution.method](contribution),
      contribution
    );
  }

  async canChangeContribution(
    contact: Contact,
    useExistingPaymentSource: boolean,
    paymentForm: PaymentForm
  ): Promise<boolean> {
    const ret = await this.provider(contact, (p) =>
      p.canChangeContribution(useExistingPaymentSource, paymentForm)
    );
    log.info(
      `Contact ${contact.id} ${ret ? "can" : "cannot"} change contribution`
    );
    return ret;
  }

  async getContributionInfo(contact: Contact): Promise<ContributionInfo> {
    return await this.provider<ContributionInfo>(
      contact,
      async (provider, contribution) => {
        // Store contribution in contact for getMembershipStatus
        // TODO: fix this!
        contact.contribution = contribution;

        const renewalDate =
          !contribution.cancelledAt && calcRenewalDate(contact);

        return {
          type: contact.contributionType,
          ...(contribution.amount !== null && {
            amount: contribution.amount
          }),
          ...(contribution.period !== null && {
            period: contribution.period
          }),
          ...(contribution.payFee !== null && {
            payFee: contribution.payFee
          }),
          ...(contribution.cancelledAt && {
            cancellationDate: contribution.cancelledAt
          }),
          ...(contact.membership?.dateExpires && {
            membershipExpiryDate: contact.membership.dateExpires
          }),
          membershipStatus: getMembershipStatus(contact),
          ...(await provider.getContributionInfo()),
          ...(renewalDate && { renewalDate })
        };
      }
    );
  }

  async getPayments(contact: Contact): Promise<Payment[]> {
    return await getRepository(Payment).findBy({ contactId: contact.id });
  }

  async onCreateContact(contact: Contact): Promise<void> {
    log.info("Create contribution for contact " + contact.id);
    await getRepository(ContactContribution).save({
      contactId: contact.id,
      status: "current",
      method: PaymentMethod.None
    });
  }

  async onUpdateContact(
    contact: Contact,
    updates: Partial<Contact>
  ): Promise<void> {
    log.info("Update contact for contact " + contact.id);
    await this.provider(contact, (p) => p.updateContact(updates));
  }

  async updateContribution(
    contact: Contact,
    form: PaymentForm
  ): Promise<UpdateContributionResult> {
    const contribution = await this.getContribution(contact);

    log.info("Update contribution for contact " + contact.id, {
      contribution,
      form
    });

    // Annual contributors can't change their period
    if (
      contact.membership?.isActive &&
      contribution.period === ContributionPeriod.Annually &&
      form.period !== ContributionPeriod.Annually
    ) {
      log.info(
        "Can't change period for active annual contributor " + contact.id
      );
      throw new CantUpdateContribution();
    }

    const result = await new PaymentProviders[contribution.method](
      contribution
    ).updateContribution(form);

    log.info("Updated contribution for contact " + contact.id, { result });

    this.setNewContribution(contribution, {
      ...contribution,
      status: result.startNow ? "current" : "pending",
      monthlyAmount: form.monthlyAmount,
      period: form.period,
      payFee: form.payFee,
      subscriptionId: result.subscriptionId
    });

    return result;
  }

  async updatePaymentMethod(
    contact: Contact,
    flow: CompletedPaymentFlow
  ): Promise<void> {
    const contribution = await this.getContribution(contact);

    log.info("Update payment method for contact " + contact.id, {
      flow,
      contribution
    });

    const newMethod = flow.paymentMethod;
    // TODO: think about this
    if (contribution.method !== newMethod) {
      log.info("Changing payment method, cancelling previous contribution", {
        contribution,
        newMethod
      });

      await new PaymentProviders[contribution.method](
        contribution
      ).cancelContribution(false);
    }

    const result = await new PaymentProviders[newMethod](
      contribution
    ).updatePaymentMethod(flow);

    log.info("Updated payment method for contact " + contact.id, { result });

    await this.setNewContribution(contribution, {
      ...contribution,
      status: "current",
      method: flow.paymentMethod,
      mandateId: flow.mandateId,
      customerId: flow.customerId,
      ...result
    });
  }

  async cancelContribution(
    contact: Contact,
    keepMandate = false
  ): Promise<void> {
    log.info("Cancel contribution for contact " + contact.id, { keepMandate });

    const contribution = await this.getContribution(contact);

    await new PaymentProviders[contribution.method](
      contribution
    ).cancelContribution(keepMandate);

    await this.setNewContribution(contribution, {
      contactId: contact.id,
      status: "current",
      method: PaymentMethod.None,
      cancelledAt: new Date()
    });
  }

  /**
   * Permanently delete or disassociate all payment related data for a contact.
   * This will also cancel any active contributions
   *
   * @param contact The contact
   */
  async permanentlyDeleteContact(contact: Contact): Promise<void> {
    log.info("Permanently delete payment data for contact " + contact.id);
    await this.provider(contact, (p) => p.permanentlyDeleteContact());

    await runTransaction(async (em) => {
      await em
        .getRepository(ContactContribution)
        .delete({ contactId: contact.id });
      await em
        .getRepository(Payment)
        .update({ contactId: contact.id }, { contactId: null });
    });
  }

  private async setNewContribution(
    oldContribution: ContactContribution,
    newContribution: DeepPartial<ContactContribution>
  ) {
    if (newContribution.status === "current") {
      await getRepository(ContactContribution).update(oldContribution.id, {
        status: null
      });
    }
    await getRepository(ContactContribution).save(newContribution);
  }
}

export default new PaymentService();

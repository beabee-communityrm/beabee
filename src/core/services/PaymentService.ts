import { MembershipStatus, PaymentMethod } from "@beabee/beabee-common";

import { getRepository, runTransaction } from "@core/database";
import { log as mainLogger } from "@core/logging";
import { calcRenewalDate } from "@core/utils/payment";

import Contact from "@models/Contact";
import Payment from "@models/Payment";
import ContactContribution from "@models/ContactContribution";

import { PaymentProvider } from "@core/providers/payment";
import GCProvider from "@core/providers/payment/GCProvider";
import ManualProvider from "@core/providers/payment/ManualProvider";
import StripeProvider from "@core/providers/payment/StripeProvider";

import {
  CompletedPaymentFlow,
  ContributionInfo,
  PaymentForm,
  UpdateContributionResult
} from "@type/index";

const log = mainLogger.child({ app: "payment-service" });

const PaymentProviders = {
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
  p: PaymentProvider,
  data: ContactContribution
) => Promise<T>;

class PaymentService {
  async getContribution(contact: Contact): Promise<ContactContribution> {
    const contribution = await getRepository(
      ContactContribution
    ).findOneByOrFail({
      contactId: contact.id
    });
    // No need to refetch contact, just add it in
    return { ...contribution, contact };
  }

  async getContributionBy(
    key: "customerId" | "mandateId" | "subscriptionId",
    value: string
  ): Promise<ContactContribution | null> {
    return await getRepository(ContactContribution).findOne({
      where: { [key]: value },
      relations: { contact: true }
    });
  }

  async updateData(contact: Contact, updates: Partial<ContactContribution>) {
    await getRepository(ContactContribution).update(contact.id, updates);
  }

  private async provider(contact: Contact, fn: ProviderFn<void>): Promise<void>;
  private async provider<T>(contact: Contact, fn: ProviderFn<T>): Promise<T>;
  private async provider<T>(contact: Contact, fn: ProviderFn<T>): Promise<T> {
    return this.providerFromData(await this.getContribution(contact), fn);
  }

  private async providerFromData<T>(
    data: ContactContribution,
    fn: ProviderFn<T>
  ): Promise<T> {
    const Provider = data.method
      ? PaymentProviders[data.method]
      : ManualProvider;
    return await fn(new Provider(data), data);
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
    return await this.provider<ContributionInfo>(contact, async (p, d) => {
      // Store payment data in contact for getMembershipStatus
      // TODO: fix this!
      contact.contribution = d;

      const renewalDate = !d.cancelledAt && calcRenewalDate(contact);

      return {
        type: contact.contributionType,
        ...(contact.contributionAmount !== null && {
          amount: contact.contributionAmount
        }),
        ...(contact.contributionPeriod !== null && {
          period: contact.contributionPeriod
        }),
        ...(contact.membership?.dateExpires && {
          membershipExpiryDate: contact.membership.dateExpires
        }),
        membershipStatus: getMembershipStatus(contact),
        ...(await p.getContributionInfo()),
        ...(d.cancelledAt && { cancellationDate: d.cancelledAt }),
        ...(renewalDate && { renewalDate })
      };
    });
  }

  async getPayments(contact: Contact): Promise<Payment[]> {
    return await getRepository(Payment).findBy({ contactId: contact.id });
  }

  async createContact(contact: Contact): Promise<void> {
    log.info("Create contact for contact " + contact.id);
    await getRepository(ContactContribution).save({ contact });
  }

  async updateContact(
    contact: Contact,
    updates: Partial<Contact>
  ): Promise<void> {
    log.info("Update contact for contact " + contact.id);
    await this.provider(contact, (p) => p.updateContact(updates));
  }

  async updateContribution(
    contact: Contact,
    paymentForm: PaymentForm
  ): Promise<UpdateContributionResult> {
    log.info("Update contribution for contact " + contact.id);
    const ret = await this.provider(contact, (p) =>
      p.updateContribution(paymentForm)
    );
    await getRepository(ContactContribution).update(
      { contactId: contact.id },
      { cancelledAt: null }
    );
    return ret;
  }

  async updatePaymentMethod(
    contact: Contact,
    completedPaymentFlow: CompletedPaymentFlow
  ): Promise<void> {
    log.info("Update payment method for contact " + contact.id, {
      completedPaymentFlow
    });

    const contribution = await this.getContribution(contact);
    const newMethod = completedPaymentFlow.joinForm.paymentMethod;
    if (contribution.method !== newMethod) {
      log.info("Changing payment method, cancelling previous contribution", {
        contribution,
        newMethod
      });
      await this.providerFromData(contribution, (p) =>
        p.cancelContribution(false)
      );

      // Clear the old payment data, set the new method
      Object.assign(contribution, {
        ...ContactContribution.empty,
        method: newMethod
      });
      await getRepository(ContactContribution).save(contribution);
    }

    await this.providerFromData(contribution, (p) =>
      p.updatePaymentMethod(completedPaymentFlow)
    );
  }

  async cancelContribution(
    contact: Contact,
    keepMandate = false
  ): Promise<void> {
    log.info("Cancel contribution for contact " + contact.id);
    await this.provider(contact, (p) => p.cancelContribution(keepMandate));
    await getRepository(ContactContribution).update(
      { contactId: contact.id },
      { cancelledAt: new Date() }
    );
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
}

export default new PaymentService();

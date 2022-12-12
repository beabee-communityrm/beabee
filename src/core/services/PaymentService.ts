import { PaymentMethod } from "@beabee/beabee-common";
import { createQueryBuilder, getRepository } from "typeorm";

import { ContributionInfo, PaymentForm } from "@core/utils";
import { log as mainLogger } from "@core/logging";
import { calcRenewalDate } from "@core/utils/payment";

import Contact from "@models/Contact";
import Payment from "@models/Payment";
import PaymentData from "@models/PaymentData";

import {
  PaymentProvider,
  UpdateContributionResult
} from "@core/providers/payment";
import GCProvider from "@core/providers/payment/GCProvider";
import ManualProvider from "@core/providers/payment/ManualProvider";
import StripeProvider from "@core/providers/payment/StripeProvider";

import { CompletedPaymentFlow } from "@core/providers/payment-flow";

const log = mainLogger.child({ app: "payment-service" });

const PaymentProviders = {
  [PaymentMethod.StripeCard]: StripeProvider,
  [PaymentMethod.StripeSEPA]: StripeProvider,
  [PaymentMethod.StripeBACS]: StripeProvider,
  [PaymentMethod.GoCardlessDirectDebit]: GCProvider
};

class PaymentService {
  async getData(contact: Contact): Promise<PaymentData> {
    const data = await getRepository(PaymentData).findOneOrFail(contact.id);
    log.info("Loaded data for " + contact.id, { data });
    // Load full contact into data
    return { ...data, contact: contact };
  }

  async getDataBy(
    key: string,
    value: string
  ): Promise<PaymentData | undefined> {
    const data = await createQueryBuilder(PaymentData, "pd")
      .innerJoinAndSelect("pd.contact", "m")
      .leftJoinAndSelect("m.roles", "mp")
      .where(`data->>:key = :value`, { key, value })
      .getOne();

    return data;
  }

  async updateDataBy(contact: Contact, key: string, value: unknown) {
    await createQueryBuilder()
      .update(PaymentData)
      .set({ data: () => "jsonb_set(data, :key, :value)" })
      .where("contact = :id")
      .setParameters({
        key: `{${key}}`,
        value: JSON.stringify(value),
        id: contact.id
      })
      .execute();
  }

  private async provider(
    contact: Contact,
    fn: (provider: PaymentProvider<any>) => Promise<void>
  ): Promise<void>;
  private async provider<T>(
    contact: Contact,
    fn: (provider: PaymentProvider<any>) => Promise<T>
  ): Promise<T>;
  private async provider<T>(
    contact: Contact,
    fn: (provider: PaymentProvider<any>) => Promise<T>
  ): Promise<T> {
    return this.providerFromData(await this.getData(contact), fn);
  }

  private async providerFromData<T>(
    data: PaymentData,
    fn: (provider: PaymentProvider<any>) => Promise<T>
  ): Promise<T> {
    const Provider = data.method
      ? PaymentProviders[data.method]
      : ManualProvider;
    return await fn(new Provider(data));
  }

  async canChangeContribution(
    contact: Contact,
    useExistingPaymentSource: boolean
  ): Promise<boolean> {
    const ret = await this.provider(contact, (p) =>
      p.canChangeContribution(useExistingPaymentSource)
    );
    log.info(
      `User ${contact.id} ${ret ? "can" : "cannot"} change contribution`
    );
    return ret;
  }

  async getContributionInfo(contact: Contact): Promise<ContributionInfo> {
    const basicInfo = {
      type: contact.contributionType,
      ...(contact.contributionAmount !== null && {
        amount: contact.contributionAmount
      }),
      ...(contact.contributionPeriod !== null && {
        period: contact.contributionPeriod
      }),
      ...(contact.membership?.dateExpires && {
        membershipExpiryDate: contact.membership.dateExpires
      })
    };

    const providerInfo = await this.provider(contact, (p) =>
      p.getContributionInfo()
    );

    const hsaCancelled = !!providerInfo.cancellationDate;
    const renewalDate = !hsaCancelled && calcRenewalDate(contact);

    return {
      ...basicInfo,
      ...providerInfo,
      ...(renewalDate && { renewalDate }),
      membershipStatus: contact.membership
        ? contact.membership.isActive
          ? hsaCancelled
            ? "expiring"
            : "active"
          : "expired"
        : "none"
    };
  }

  async getPayments(contact: Contact): Promise<Payment[]> {
    return await getRepository(Payment).find({ contact: contact });
  }

  async createContact(contact: Contact): Promise<void> {
    log.info("Create contact for " + contact.id);
    await getRepository(PaymentData).save({ contact });
  }

  async updateContact(
    contact: Contact,
    updates: Partial<Contact>
  ): Promise<void> {
    log.info("Update contact for " + contact.id);
    await this.provider(contact, (p) => p.updateContact(updates));
  }

  async updateContribution(
    contact: Contact,
    paymentForm: PaymentForm
  ): Promise<UpdateContributionResult> {
    log.info("Update contribution for " + contact.id);
    return await this.provider(contact, (p) =>
      p.updateContribution(paymentForm)
    );
  }

  async updatePaymentMethod(
    contact: Contact,
    completedPaymentFlow: CompletedPaymentFlow
  ): Promise<void> {
    log.info("Update payment method for " + contact.id, {
      completedPaymentFlow
    });

    const data = await this.getData(contact);
    const newMethod = completedPaymentFlow.paymentMethod;
    if (data.method !== newMethod) {
      log.info(
        "Changing payment method, cancelling any previous contribution",
        { oldMethod: data.method, data: data.data, newMethod }
      );
      await this.providerFromData(data, (p) => p.cancelContribution(false));

      data.method = newMethod;
      data.data = {};
      await getRepository(PaymentData).save(data);
    }

    await this.providerFromData(data, (p) =>
      p.updatePaymentMethod(completedPaymentFlow)
    );
  }

  async cancelContribution(
    contact: Contact,
    keepMandate = false
  ): Promise<void> {
    log.info("Cancel contribution for " + contact.id);
    await this.provider(contact, (p) => p.cancelContribution(keepMandate));
  }

  async permanentlyDeleteContact(contact: Contact): Promise<void> {
    await this.provider(contact, (p) => p.permanentlyDeleteContact());
    await getRepository(PaymentData).delete({ contact: contact });
    await getRepository(Payment).delete({ contact: contact });
  }
}

export default new PaymentService();

import { PaymentMethod } from "@beabee/beabee-common";

import { getRepository } from "#core/database";
import { PaymentForm } from "#core/utils";

import { CompletedPaymentFlow } from "#core/providers/payment-flow";

import Contact from "#models/Contact";
import PaymentData, { PaymentProviderData } from "#models/PaymentData";
import { ContributionInfo } from "#type/contribution-info";

export interface UpdateContributionResult {
  startNow: boolean;
  expiryDate: Date;
}

export abstract class PaymentProvider<T extends PaymentProviderData> {
  protected readonly data: T;
  protected readonly contact: Contact;
  protected readonly method: PaymentMethod;

  constructor(data: PaymentData) {
    this.data = data.data as T;
    this.contact = data.contact;
    this.method = data.method as PaymentMethod;
  }

  protected async updateData() {
    await getRepository(PaymentData).update(this.contact.id, {
      data: this.data
    });
  }

  abstract canChangeContribution(
    useExistingMandate: boolean,
    paymentForm: PaymentForm
  ): Promise<boolean>;

  abstract cancelContribution(keepMandate: boolean): Promise<void>;

  abstract getContributionInfo(): Promise<Partial<ContributionInfo>>;

  abstract updateContact(updates: Partial<Contact>): Promise<void>;

  abstract updateContribution(
    paymentForm: PaymentForm
  ): Promise<UpdateContributionResult>;

  abstract updatePaymentMethod(
    completedPaymentFlow: CompletedPaymentFlow
  ): Promise<void>;

  abstract permanentlyDeleteContact(): Promise<void>;
}

import { PaymentProvider } from ".";

import {
  ContributionInfo,
  UpdateContributionResult,
  UpdatePaymentMethodResult
} from "@type/index";

export default class ManualProvider extends PaymentProvider {
  async canChangeContribution(useExistingMandate: boolean): Promise<boolean> {
    return !useExistingMandate;
  }
  async getContributionInfo(): Promise<Partial<ContributionInfo>> {
    return {
      paymentSource: {
        method: null,
        ...(this.data.customerId && {
          reference: this.data.customerId
        }),
        ...(this.data.mandateId && {
          source: this.data.mandateId
        })
      }
    };
  }

  async cancelContribution(): Promise<void> {}
  async updateContact(): Promise<void> {}

  async updateContribution(): Promise<UpdateContributionResult> {
    return { startNow: true, subscriptionId: "" };
  }
  async updatePaymentMethod(): Promise<UpdatePaymentMethodResult> {
    return {};
  }
  async permanentlyDeleteContact(): Promise<void> {}
}

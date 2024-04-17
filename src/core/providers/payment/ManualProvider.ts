import { PaymentForm } from "@core/utils";
import Contact from "@models/Contact";
import { PaymentProvider, UpdateContributionResult } from ".";
import { CompletedPaymentFlow } from "../payment-flow";
import { ContributionInfo } from "@type/contribution-info";

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

  async cancelContribution(keepMandate: boolean): Promise<void> {}
  async updateContact(updates: Partial<Contact>): Promise<void> {}

  async updateContribution(
    paymentForm: PaymentForm
  ): Promise<UpdateContributionResult> {
    throw new Error("Method not implemented.");
  }
  async updatePaymentMethod(
    completedPaymentFlow: CompletedPaymentFlow
  ): Promise<void> {
    throw new Error("Method not implemented.");
  }
  async permanentlyDeleteContact(): Promise<void> {
    throw new Error("Method not implemented.");
  }
}

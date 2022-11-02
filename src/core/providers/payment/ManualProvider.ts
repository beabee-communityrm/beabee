import { ContributionInfo, PaymentForm } from "@core/utils";
import Member from "@models/Member";
import { ManualPaymentData } from "@models/PaymentData";
import { PaymentProvider, UpdateContributionResult } from ".";
import { CompletedPaymentFlow } from "../payment-flow";

export default class ManualProvider extends PaymentProvider<
  ManualPaymentData | {}
> {
  async canChangeContribution(useExistingMandate: boolean): Promise<boolean> {
    return !useExistingMandate;
  }
  async getContributionInfo(): Promise<Partial<ContributionInfo>> {
    return {
      paymentSource: {
        method: null,
        ...this.data
      }
    };
  }

  async cancelContribution(keepMandate: boolean): Promise<void> {}
  async updateMember(updates: Partial<Member>): Promise<void> {}

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
  async permanentlyDeleteMember(): Promise<void> {
    throw new Error("Method not implemented.");
  }
}

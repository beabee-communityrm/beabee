import {
  CompletedPaymentFlow,
  PaymentProvider,
  PaymentFlow,
  PaymentFlowParams,
  UpdateContributionData
} from "@core/providers/payment";
import { PaymentForm } from "@core/utils";
import Address from "@models/Address";
import JoinFlow from "@models/JoinFlow";
import Member from "@models/Member";

class StripePaymentService implements PaymentProvider {
  completePaymentFlow(joinFlow: JoinFlow): Promise<CompletedPaymentFlow> {
    throw new Error("Method not implemented.");
  }
  updatePaymentSource(
    member: Member,
    customerId: string,
    mandateId: string
  ): Promise<void> {
    throw new Error("Method not implemented.");
  }
  updateContribution(
    member: Member,
    paymentForm: PaymentForm
  ): Promise<UpdateContributionData> {
    throw new Error("Method not implemented.");
  }
  customerToMember(
    customerId: string
  ): Promise<{ partialMember: Partial<Member>; billingAddress: Address }> {
    throw new Error("Method not implemented.");
  }
  createPaymentFlow(
    joinFlow: JoinFlow,
    completeUrl: string,
    params: PaymentFlowParams
  ): Promise<PaymentFlow> {
    throw new Error("Method not implemented.");
  }
  hasPendingPayment(member: Member): Promise<boolean> {
    throw new Error("Method not implemented.");
  }
  cancelContribution(member: Member): Promise<void> {
    throw new Error("Method not implemented.");
  }
}

export default new StripePaymentService();

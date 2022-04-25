import {
  CompletedPaymentRedirectFlow,
  PaymentProvider,
  PaymentRedirectFlow,
  PaymentRedirectFlowParams
} from "@core/providers/payment";
import { PaymentForm } from "@core/utils";
import Address from "@models/Address";
import JoinFlow from "@models/JoinFlow";
import Member from "@models/Member";

class StripePaymentService implements PaymentProvider {
  completeRedirectFlow(
    joinFlow: JoinFlow
  ): Promise<CompletedPaymentRedirectFlow> {
    throw new Error("Method not implemented.");
  }
  updatePaymentSource(
    member: Member,
    customerId: string,
    mandateId: string
  ): Promise<void> {
    throw new Error("Method not implemented.");
  }
  updateContribution(member: Member, paymentForm: PaymentForm): Promise<void> {
    throw new Error("Method not implemented.");
  }
  customerToMember(
    customerId: string
  ): Promise<{ partialMember: Partial<Member>; billingAddress: Address }> {
    throw new Error("Method not implemented.");
  }
  createRedirectFlow(
    joinFlow: JoinFlow,
    completeUrl: string,
    params: PaymentRedirectFlowParams
  ): Promise<PaymentRedirectFlow> {
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

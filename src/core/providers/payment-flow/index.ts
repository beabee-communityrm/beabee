import JoinFlow from "@models/JoinFlow";
import {
  CompletedPaymentFlow,
  CompletedPaymentFlowData,
  PaymentFlow,
  PaymentFlowData
} from "@type/index";

export abstract class PaymentFlowProvider {
  abstract createPaymentFlow(
    joinFlow: JoinFlow,
    completeUrl: string,
    data: PaymentFlowData
  ): Promise<PaymentFlow>;

  abstract completePaymentFlow(
    joinFlow: JoinFlow
  ): Promise<CompletedPaymentFlow>;

  abstract getCompletedPaymentFlowData(
    completedPaymentFlow: CompletedPaymentFlow
  ): Promise<CompletedPaymentFlowData>;
}

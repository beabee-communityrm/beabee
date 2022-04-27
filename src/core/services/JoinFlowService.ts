import { getRepository } from "typeorm";

import { CompletedPaymentFlow } from "@core/providers/payment";
import { ContributionPeriod, PaymentMethod } from "@core/utils";

import PaymentService from "@core/services/PaymentService";

import JoinFlow from "@models/JoinFlow";
import JoinForm from "@models/JoinForm";

class JoinFlowService {
  async createJoinFlow(
    form: Pick<JoinForm, "email" | "password">
  ): Promise<JoinFlow> {
    const joinForm: JoinForm = {
      ...form,
      // TODO: stubbed here, should be optional
      monthlyAmount: 0,
      period: ContributionPeriod.Monthly,
      payFee: false,
      prorate: false,
      paymentMethod: PaymentMethod.DirectDebit
    };
    return await getRepository(JoinFlow).save({
      joinForm,
      paymentFlowId: ""
    });
  }

  async createPaymentJoinFlow(
    joinForm: JoinForm,
    completeUrl: string,
    user: { email: string; firstname?: string; lastname?: string }
  ): Promise<{ joinFlow: JoinFlow; redirectUrl: string }> {
    const joinFlow = await getRepository(JoinFlow).save({
      joinForm,
      paymentFlowId: ""
    });

    const paymentFlow = await PaymentService.createPaymentFlow(
      joinFlow,
      completeUrl,
      user
    );
    await getRepository(JoinFlow).update(joinFlow.id, {
      paymentFlowId: paymentFlow.id
    });
    return { joinFlow, redirectUrl: paymentFlow.url };
  }

  async getJoinFlow(paymentFlowId: string): Promise<JoinFlow | undefined> {
    return await getRepository(JoinFlow).findOne({ paymentFlowId });
  }

  async completeJoinFlow(
    joinFlow: JoinFlow
  ): Promise<CompletedPaymentFlow | undefined> {
    if (joinFlow.paymentFlowId) {
      const paymentFlow = await PaymentService.completePaymentFlow(joinFlow);
      await getRepository(JoinFlow).delete(joinFlow.id);

      return paymentFlow;
    } else {
      await getRepository(JoinFlow).delete(joinFlow.id);
    }
  }
}

export default new JoinFlowService();

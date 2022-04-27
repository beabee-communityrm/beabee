import { getRepository } from "typeorm";

import { CompletedPaymentRedirectFlow } from "@core/providers/payment";
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
      redirectFlowId: ""
    });
  }

  async createPaymentJoinFlow(
    joinForm: JoinForm,
    completeUrl: string,
    user: { email: string; firstname?: string; lastname?: string }
  ): Promise<{ joinFlow: JoinFlow; redirectUrl: string }> {
    const joinFlow = await getRepository(JoinFlow).save({
      joinForm,
      redirectFlowId: ""
    });

    const redirectFlow = await PaymentService.createRedirectFlow(
      joinFlow,
      completeUrl,
      user
    );
    await getRepository(JoinFlow).update(joinFlow.id, {
      redirectFlowId: redirectFlow.id
    });
    return { joinFlow, redirectUrl: redirectFlow.url };
  }

  async getJoinFlow(redirectFlowId: string): Promise<JoinFlow | undefined> {
    return await getRepository(JoinFlow).findOne({ redirectFlowId });
  }

  async completeJoinFlow(
    joinFlow: JoinFlow
  ): Promise<CompletedPaymentRedirectFlow | undefined> {
    if (joinFlow.redirectFlowId) {
      const redirectFlow = await PaymentService.completeRedirectFlow(joinFlow);
      await getRepository(JoinFlow).delete(joinFlow.id);

      return redirectFlow;
    } else {
      await getRepository(JoinFlow).delete(joinFlow.id);
    }
  }
}

export default new JoinFlowService();

import { getRepository } from "typeorm";

import { CompletedPaymentRedirectFlow } from "@core/providers/payment";

import PaymentService from "@core/services/PaymentService";

import JoinFlow from "@models/JoinFlow";
import JoinForm from "@models/JoinForm";

class JoinFlowService {
  async createJoinFlow(joinForm: JoinForm): Promise<{ joinFlow: JoinFlow }>;
  async createJoinFlow(
    joinForm: JoinForm,
    completeUrl: string,
    user: { email: string; firstname?: string; lastname?: string }
  ): Promise<{ joinFlow: JoinFlow; redirectUrl: string }>;
  async createJoinFlow(
    joinForm: JoinForm,
    completeUrl?: string,
    user?: { email: string; firstname?: string; lastname?: string }
  ): Promise<{ joinFlow: JoinFlow; redirectUrl?: string }> {
    const joinFlow = await getRepository(JoinFlow).save({
      joinForm,
      redirectFlowId: ""
    });

    if (completeUrl && user) {
      const redirectFlow = await PaymentService.createRedirectFlow(
        joinFlow,
        completeUrl,
        user
      );
      await getRepository(JoinFlow).update(joinFlow.id, {
        redirectFlowId: redirectFlow.id
      });
      return { joinFlow, redirectUrl: redirectFlow.url };
    } else {
      return { joinFlow };
    }
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

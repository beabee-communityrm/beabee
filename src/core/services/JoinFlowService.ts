import { getRepository } from "typeorm";

import { generateCode } from "@core/utils/auth";

import GCPaymentService from "@core/services/GCPaymentService";

import JoinFlow from "@models/JoinFlow";
import JoinForm from "@models/JoinForm";
import Password from "@models/Password";
import { ContributionPeriod } from "@core/utils";

export interface CompletedJoinFlow {
  customerId: string;
  mandateId: string;
}

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
    const joinFlow = await getRepository(JoinFlow).save({ joinForm });

    if (completeUrl && user) {
      const redirectFlow = await GCPaymentService.createRedirectFlow(
        joinFlow.id,
        completeUrl,
        {
          prefilled_customer: {
            email: user.email,
            ...(user.firstname && { given_name: user.firstname }),
            ...(user.lastname && { family_name: user.lastname })
          }
        }
      );
      await getRepository(JoinFlow).update(joinFlow.id, {
        redirectFlowId: redirectFlow.id
      });
      return { joinFlow, redirectUrl: redirectFlow.redirect_url };
    } else {
      return { joinFlow };
    }
  }

  async getJoinFlow(redirectFlowId: string): Promise<JoinFlow | undefined> {
    return await getRepository(JoinFlow).findOne({ redirectFlowId });
  }

  async completeJoinFlow(
    joinFlow: JoinFlow
  ): Promise<CompletedJoinFlow | undefined> {
    if (joinFlow.redirectFlowId) {
      const redirectFlow = await GCPaymentService.completeRedirectFlow(
        joinFlow.redirectFlowId,
        joinFlow.id
      );
      await getRepository(JoinFlow).delete(joinFlow.id);

      return {
        customerId: redirectFlow.links.customer,
        mandateId: redirectFlow.links.mandate
      };
    } else {
      await getRepository(JoinFlow).delete(joinFlow.id);
    }
  }
}

export default new JoinFlowService();

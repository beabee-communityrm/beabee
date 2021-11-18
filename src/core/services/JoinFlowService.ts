import { getRepository } from "typeorm";

import { generateCode } from "@core/utils/auth";

import GCPaymentService from "@core/services/GCPaymentService";

import JoinFlow from "@models/JoinFlow";
import JoinForm from "@models/JoinForm";

export interface CompletedJoinFlow {
  customerId: string;
  mandateId: string;
}

class JoinFlowService {
  async createJoinFlow(
    completeUrl: string,
    joinForm: JoinForm,
    user: { email: string; firstname?: string; lastname?: string }
  ): Promise<string> {
    const sessionToken = generateCode();
    const redirectFlow = await GCPaymentService.createRedirectFlow(
      sessionToken,
      completeUrl,
      {
        prefilled_customer: {
          email: user.email,
          ...(user.firstname && { given_name: user.firstname }),
          ...(user.lastname && { family_name: user.lastname })
        }
      }
    );
    const joinFlow = new JoinFlow();
    joinFlow.redirectFlowId = redirectFlow.id;
    joinFlow.sessionToken = sessionToken;
    joinFlow.joinForm = joinForm;

    await getRepository(JoinFlow).save(joinFlow);

    return redirectFlow.redirect_url;
  }

  async getJoinFlow(redirectFlowId: string): Promise<JoinFlow | undefined> {
    return await getRepository(JoinFlow).findOne({ redirectFlowId });
  }

  async completeJoinFlow(joinFlow: JoinFlow): Promise<CompletedJoinFlow> {
    const redirectFlow = await GCPaymentService.completeRedirectFlow(
      joinFlow.redirectFlowId,
      joinFlow.sessionToken
    );
    await getRepository(JoinFlow).delete(joinFlow.id);

    return {
      customerId: redirectFlow.links.customer,
      mandateId: redirectFlow.links.mandate
    };
  }
}

export default new JoinFlowService();

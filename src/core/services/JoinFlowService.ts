import { getRepository } from "typeorm";

import { generateCode } from "@core/utils/auth";

import GCPaymentService from "@core/services/GCPaymentService";

import JoinFlow from "@models/JoinFlow";
import JoinForm from "@models/JoinForm";

export interface CompletedJoinFlow {
  customerId: string;
  mandateId: string;
  joinForm: JoinForm;
}

export default class JoinFlowService {
  static async createJoinFlow(
    completeUrl: string,
    joinForm: JoinForm,
    redirectFlowParams = {}
  ): Promise<string> {
    const sessionToken = generateCode();
    const redirectFlow = await GCPaymentService.createRedirectFlow(
      sessionToken,
      completeUrl,
      redirectFlowParams
    );
    const joinFlow = new JoinFlow();
    joinFlow.redirectFlowId = redirectFlow.id;
    joinFlow.sessionToken = sessionToken;
    joinFlow.joinForm = joinForm;

    await getRepository(JoinFlow).save(joinFlow);

    return redirectFlow.redirect_url;
  }

  static async completeJoinFlow(joinFlow: JoinFlow): Promise<CompletedJoinFlow>;
  static async completeJoinFlow(
    redirectFlowId: string
  ): Promise<CompletedJoinFlow | undefined>;
  static async completeJoinFlow(
    arg1: string | JoinFlow
  ): Promise<CompletedJoinFlow | undefined> {
    const joinFlow =
      typeof arg1 === "string"
        ? await getRepository(JoinFlow).findOne({ redirectFlowId: arg1 })
        : arg1;

    if (joinFlow) {
      const redirectFlow = await GCPaymentService.completeRedirectFlow(
        joinFlow.redirectFlowId,
        joinFlow.sessionToken
      );
      await getRepository(JoinFlow).delete(joinFlow.id);

      return {
        customerId: redirectFlow.links.customer,
        mandateId: redirectFlow.links.mandate,
        joinForm: joinFlow.joinForm
      };
    }
  }
}

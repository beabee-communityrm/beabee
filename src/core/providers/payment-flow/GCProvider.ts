import gocardless from "@core/lib/gocardless";
import { log as mainLogger } from "@core/logging";

import JoinFlow from "@models/JoinFlow";

import {
  CompletedPaymentFlow,
  CompletedPaymentFlowData,
  PaymentFlow,
  PaymentFlowData,
  PaymentFlowProvider
} from ".";

const log = mainLogger.child({ app: "gc-payment-flow-provider" });

class GCProvider implements PaymentFlowProvider {
  async createPaymentFlow(
    joinFlow: JoinFlow,
    completeUrl: string,
    params: PaymentFlowData
  ): Promise<PaymentFlow> {
    const redirectFlow = await gocardless.redirectFlows.create({
      session_token: joinFlow.id,
      success_redirect_url: completeUrl,
      prefilled_customer: {
        email: params.email,
        ...(params.firstname && { given_name: params.firstname }),
        ...(params.lastname && { family_name: params.lastname })
      }
    });
    log.info("Created redirect flow " + redirectFlow.id);

    return {
      id: redirectFlow.id!,
      params: {
        redirectUrl: redirectFlow.redirect_url!
      }
    };
  }

  async completePaymentFlow(joinFlow: JoinFlow): Promise<CompletedPaymentFlow> {
    const redirectFlow = await gocardless.redirectFlows.complete(
      joinFlow.paymentFlowId,
      {
        session_token: joinFlow.id
      }
    );
    log.info("Completed redirect flow " + redirectFlow.id);

    return {
      joinForm: joinFlow.joinForm,
      customerId: redirectFlow.links!.customer!,
      mandateId: redirectFlow.links!.mandate!
    };
  }

  async getCompletedPaymentFlowData(
    completedPaymentFlow: CompletedPaymentFlow
  ): Promise<CompletedPaymentFlowData> {
    const customer = await gocardless.customers.get(
      completedPaymentFlow.customerId
    );

    return {
      ...(customer.given_name && { firstname: customer.given_name }),
      ...(customer.family_name && { lastname: customer.family_name }),
      billingAddress: {
        line1: customer.address_line1 || "",
        line2: customer.address_line2 || undefined,
        city: customer.city || "",
        postcode: customer.postal_code || ""
      }
    };
  }
}

export default new GCProvider();

import { ContributionPeriod, PaymentMethod } from "@beabee/beabee-common";

import { getRepository } from "@core/database";
import { log as mainLogger } from "@core/logging";

import EmailService from "@core/services/EmailService";
import ContactsService from "@core/services/ContactsService";
import OptionsService from "@core/services/OptionsService";
import PaymentService from "@core/services/PaymentService";
import ResetSecurityFlowService from "./ResetSecurityFlowService";
import JoinFlow from "@models/JoinFlow";
import JoinForm from "@models/JoinForm";
import Contact from "@models/Contact";

import {
  CompletedPaymentFlow,
  CompletedPaymentFlowData,
  PaymentFlow,
  PaymentFlowData,
  PaymentFlowParams,
  PaymentFlowProvider
} from "@core/providers/payment-flow";
import StripeProvider from "@core/providers/payment-flow/StripeProvider";
import GCProvider from "@core/providers/payment-flow/GCProvider";

import DuplicateEmailError from "@api/errors/DuplicateEmailError";

import { RESET_SECURITY_FLOW_TYPE } from "@enums/reset-security-flow-type";

import { Address } from "@type/address";
import { CompleteUrls } from "@type/complete-urls";

const paymentProviders = {
  [PaymentMethod.StripeCard]: StripeProvider,
  [PaymentMethod.StripeSEPA]: StripeProvider,
  [PaymentMethod.StripeBACS]: StripeProvider,
  [PaymentMethod.StripePayPal]: StripeProvider,
  [PaymentMethod.GoCardlessDirectDebit]: GCProvider
};

const log = mainLogger.child({ app: "payment-flow-service" });

class PaymentFlowService implements PaymentFlowProvider {
  async createJoinFlow(
    form: Pick<JoinForm, "email" | "password">,
    urls: CompleteUrls
  ): Promise<JoinFlow> {
    const joinForm: JoinForm = {
      ...form,
      monthlyAmount: 0, // Currently used below to flag a no contribution join flow
      // TODO: stubbed here, should be optional
      period: ContributionPeriod.Monthly,
      payFee: false,
      prorate: false,
      paymentMethod: PaymentMethod.StripeCard
    };
    return await getRepository(JoinFlow).save({
      ...urls,
      joinForm,
      paymentFlowId: ""
    });
  }

  async createPaymentJoinFlow(
    joinForm: JoinForm,
    urls: CompleteUrls,
    completeUrl: string,
    user: { email: string; firstname?: string; lastname?: string }
  ): Promise<PaymentFlowParams> {
    const joinFlow = await getRepository(JoinFlow).save({
      ...urls,
      joinForm,
      paymentFlowId: ""
    });

    log.info("Creating payment join flow " + joinFlow.id, { joinForm });

    const paymentFlow = await this.createPaymentFlow(
      joinFlow,
      completeUrl,
      user
    );
    await getRepository(JoinFlow).update(joinFlow.id, {
      paymentFlowId: paymentFlow.id
    });
    return paymentFlow.params;
  }

  async getJoinFlowByPaymentId(
    paymentFlowId: string
  ): Promise<JoinFlow | null> {
    return await getRepository(JoinFlow).findOneBy({ paymentFlowId });
  }

  async completeJoinFlow(joinFlow: JoinFlow): Promise<CompletedPaymentFlow> {
    log.info("Completing join flow " + joinFlow.id);
    const paymentFlow = await this.completePaymentFlow(joinFlow);
    await getRepository(JoinFlow).delete(joinFlow.id);
    return paymentFlow;
  }

  async sendConfirmEmail(joinFlow: JoinFlow): Promise<void> {
    log.info("Send confirm email for " + joinFlow.id);

    const contact = await ContactsService.findOneBy({
      email: joinFlow.joinForm.email
    });

    if (contact?.membership?.isActive) {
      if (contact.password.hash) {
        await EmailService.sendTemplateToContact(
          "email-exists-login",
          contact,
          {
            loginLink: joinFlow.loginUrl
          }
        );
      } else {
        const rpFlow = await ResetSecurityFlowService.create(
          contact,
          RESET_SECURITY_FLOW_TYPE.PASSWORD
        );
        await EmailService.sendTemplateToContact(
          "email-exists-set-password",
          contact,
          {
            spLink: joinFlow.setPasswordUrl + "/" + rpFlow.id
          }
        );
      }
    } else {
      await EmailService.sendTemplateTo(
        "confirm-email",
        { email: joinFlow.joinForm.email },
        {
          firstName: joinFlow.joinForm.firstname || "",
          lastName: joinFlow.joinForm.lastname || "",
          confirmLink: joinFlow.confirmUrl + "/" + joinFlow.id
        }
      );
    }
  }

  async completeConfirmEmail(joinFlow: JoinFlow): Promise<Contact> {
    // Check for an existing active member first to avoid completing the join
    // flow unnecessarily. This should never really happen as the user won't
    // get a confirm email if they are already an active member
    let contact = await ContactsService.findOne({
      where: { email: joinFlow.joinForm.email },
      relations: { profile: true }
    });
    if (contact?.membership?.isActive) {
      throw new DuplicateEmailError();
    }

    const partialContact = {
      email: joinFlow.joinForm.email,
      password: joinFlow.joinForm.password,
      firstname: joinFlow.joinForm.firstname || "",
      lastname: joinFlow.joinForm.lastname || ""
    };

    let completedPaymentFlow: CompletedPaymentFlow | undefined;
    let deliveryAddress: Address | undefined;

    // Only complete join flow for those with a contribution
    // TODO: rework join flow to properly accommodate no contributions
    if (joinFlow.joinForm.monthlyAmount !== 0) {
      completedPaymentFlow = await this.completeJoinFlow(joinFlow);
      const paymentData =
        await this.getCompletedPaymentFlowData(completedPaymentFlow);

      // Prefill contact data from payment provider if possible
      partialContact.firstname ||= paymentData.firstname || "";
      partialContact.lastname ||= paymentData.lastname || "";
      deliveryAddress = OptionsService.getBool("show-mail-opt-in")
        ? paymentData.billingAddress
        : undefined;
    }

    if (contact) {
      await ContactsService.updateContact(contact, partialContact);
    } else {
      contact = await ContactsService.createContact(
        partialContact,
        deliveryAddress ? { deliveryAddress } : undefined
      );
    }

    if (completedPaymentFlow) {
      await PaymentService.updatePaymentMethod(contact, completedPaymentFlow);
      await ContactsService.updateContactContribution(
        contact,
        joinFlow.joinForm
      );
    }

    await EmailService.sendTemplateToContact("welcome", contact);

    return contact;
  }

  async createPaymentFlow(
    joinFlow: JoinFlow,
    completeUrl: string,
    data: PaymentFlowData
  ): Promise<PaymentFlow> {
    log.info("Create payment flow for " + joinFlow.id);
    return paymentProviders[joinFlow.joinForm.paymentMethod].createPaymentFlow(
      joinFlow,
      completeUrl,
      data
    );
  }

  async completePaymentFlow(joinFlow: JoinFlow): Promise<CompletedPaymentFlow> {
    log.info("Complete payment flow for " + joinFlow.id);
    return paymentProviders[
      joinFlow.joinForm.paymentMethod
    ].completePaymentFlow(joinFlow);
  }

  async getCompletedPaymentFlowData(
    completedPaymentFlow: CompletedPaymentFlow
  ): Promise<CompletedPaymentFlowData> {
    return paymentProviders[
      completedPaymentFlow.joinForm.paymentMethod
    ].getCompletedPaymentFlowData(completedPaymentFlow);
  }
}

export default new PaymentFlowService();

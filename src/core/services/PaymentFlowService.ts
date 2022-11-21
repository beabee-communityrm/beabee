import {
  ContributionPeriod,
  NewsletterStatus,
  PaymentMethod
} from "@beabee/beabee-common";
import { getRepository } from "typeorm";

import { log as mainLogger } from "@core/logging";

import EmailService from "@core/services/EmailService";
import MembersService from "@core/services/MembersService";
import OptionsService from "@core/services/OptionsService";
import PaymentService from "@core/services/PaymentService";

import Address from "@models/Address";
import JoinFlow from "@models/JoinFlow";
import JoinForm from "@models/JoinForm";
import Member from "@models/Member";
import MemberProfile from "@models/MemberProfile";
import ResetPasswordFlow from "@models/ResetPasswordFlow";

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

import { CompleteUrls } from "@api/data/SignupData";
import DuplicateEmailError from "@api/errors/DuplicateEmailError";

const paymentProviders = {
  [PaymentMethod.StripeCard]: StripeProvider,
  [PaymentMethod.StripeSEPA]: StripeProvider,
  [PaymentMethod.StripeBACS]: StripeProvider,
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
  ): Promise<JoinFlow | undefined> {
    return await getRepository(JoinFlow).findOne({ paymentFlowId });
  }

  async completeJoinFlow(joinFlow: JoinFlow): Promise<CompletedPaymentFlow> {
    log.info("Completing join flow " + joinFlow.id);
    const paymentFlow = await this.completePaymentFlow(joinFlow);
    await getRepository(JoinFlow).delete(joinFlow.id);
    return paymentFlow;
  }

  async sendConfirmEmail(joinFlow: JoinFlow): Promise<void> {
    log.info("Send confirm email for " + joinFlow.id);

    const member = await MembersService.findOne({
      email: joinFlow.joinForm.email
    });

    if (member?.membership?.isActive) {
      if (member.password.hash) {
        await EmailService.sendTemplateToMember("email-exists-login", member, {
          loginLink: joinFlow.loginUrl
        });
      } else {
        const rpFlow = await getRepository(ResetPasswordFlow).save({ member });
        await EmailService.sendTemplateToMember(
          "email-exists-set-password",
          member,
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

  async completeConfirmEmail(joinFlow: JoinFlow): Promise<Member> {
    // Check for an existing active member first to avoid completing the join
    // flow unnecessarily. This should never really happen as the user won't
    // get a confirm email if they are already an active member
    let member = await MembersService.findOne({
      where: { email: joinFlow.joinForm.email },
      relations: ["profile"]
    });
    if (member?.membership?.isActive) {
      throw new DuplicateEmailError();
    }

    const partialMember = {
      email: joinFlow.joinForm.email,
      password: joinFlow.joinForm.password,
      firstname: joinFlow.joinForm.firstname || "",
      lastname: joinFlow.joinForm.lastname || ""
    };
    const partialProfile = {
      newsletterStatus: NewsletterStatus.Subscribed,
      newsletterGroups: OptionsService.getList("newsletter-default-groups")
    };

    let completedPaymentFlow: CompletedPaymentFlow | undefined;
    let deliveryAddress: Address | undefined;

    // Only complete join flow for those with a contribution
    // TODO: rework join flow to properly accommodate no contributions
    if (joinFlow.joinForm.monthlyAmount !== 0) {
      completedPaymentFlow = await this.completeJoinFlow(joinFlow);
      const paymentData = await this.getCompletedPaymentFlowData(
        completedPaymentFlow
      );

      // Prefill member data from payment provider if possible
      partialMember.firstname ||= paymentData.firstname || "";
      partialMember.lastname ||= paymentData.lastname || "";
      deliveryAddress = OptionsService.getBool("show-mail-opt-in")
        ? paymentData.billingAddress
        : undefined;
    }

    if (member) {
      await MembersService.updateMember(member, partialMember);
      await MembersService.updateMemberProfile(member, partialProfile);
    } else {
      member = await MembersService.createMember(partialMember, {
        ...partialProfile,
        ...(deliveryAddress ? { deliveryAddress } : undefined)
      });
    }

    if (completedPaymentFlow) {
      await PaymentService.updatePaymentMethod(member, completedPaymentFlow);
      await MembersService.updateMemberContribution(member, joinFlow.joinForm);
    }

    await EmailService.sendTemplateToMember("welcome", member);

    return member;
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
      completedPaymentFlow.paymentMethod
    ].getCompletedPaymentFlowData(completedPaymentFlow);
  }
}

export default new PaymentFlowService();

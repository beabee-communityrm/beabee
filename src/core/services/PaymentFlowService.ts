import { getRepository } from "typeorm";

import { ContributionPeriod, PaymentMethod } from "@core/utils";

import EmailService from "@core/services/EmailService";
import MembersService from "@core/services/MembersService";
import OptionsService from "@core/services/OptionsService";
import PaymentService from "@core/services/PaymentService";

import JoinFlow from "@models/JoinFlow";
import JoinForm from "@models/JoinForm";
import Member from "@models/Member";
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
  [PaymentMethod.GoCardlessDirectDebit]: GCProvider
};

class PaymentFlowService implements PaymentFlowProvider {
  async createJoinFlow(
    form: Pick<JoinForm, "email" | "password">,
    urls: CompleteUrls
  ): Promise<JoinFlow> {
    const joinForm: JoinForm = {
      ...form,
      // TODO: stubbed here, should be optional
      monthlyAmount: 0,
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
    const paymentFlow = await this.completePaymentFlow(joinFlow);
    await getRepository(JoinFlow).delete(joinFlow.id);
    return paymentFlow;
  }

  async sendConfirmEmail(joinFlow: JoinFlow): Promise<void> {
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
          firstName: "", // We don't know this yet
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

    const completedFlow = await this.completeJoinFlow(joinFlow);
    const paymentData = await this.getCompletedPaymentFlowData(completedFlow);

    const partialMember = {
      email: joinFlow.joinForm.email,
      password: joinFlow.joinForm.password,
      firstname: paymentData.firstname || "",
      lastname: paymentData.lastname || ""
    };

    if (member) {
      await MembersService.updateMember(member, partialMember);
    } else {
      member = await MembersService.createMember(
        partialMember,
        OptionsService.getBool("show-mail-opt-in") && paymentData.billingAddress
          ? { deliveryAddress: paymentData.billingAddress }
          : undefined
      );
    }

    await PaymentService.updatePaymentMethod(member, completedFlow);
    await MembersService.updateMemberContribution(member, joinFlow.joinForm);

    await EmailService.sendTemplateToMember("welcome", member);

    return member;
  }

  async createPaymentFlow(
    joinFlow: JoinFlow,
    completeUrl: string,
    data: PaymentFlowData
  ): Promise<PaymentFlow> {
    return paymentProviders[joinFlow.joinForm.paymentMethod].createPaymentFlow(
      joinFlow,
      completeUrl,
      data
    );
  }

  async completePaymentFlow(joinFlow: JoinFlow): Promise<CompletedPaymentFlow> {
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

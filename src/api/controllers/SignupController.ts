import { Request } from "express";
import {
  Body,
  JsonController,
  NotFoundError,
  OnUndefined,
  Post,
  Req
} from "routing-controllers";
import { getRepository } from "typeorm";

import { ContributionType } from "@core/utils";
import { generatePassword } from "@core/utils/auth";

import { PaymentFlowParams } from "@core/providers/payment";

import EmailService from "@core/services/EmailService";
import JoinFlowService from "@core/services/JoinFlowService";
import MembersService from "@core/services/MembersService";
import OptionsService from "@core/services/OptionsService";
import PaymentService from "@core/services/PaymentService";

import JoinFlow from "@models/JoinFlow";
import MemberProfile from "@models/MemberProfile";

import {
  SignupData,
  SignupCompleteData,
  SignupConfirmEmailParam
} from "@api/data/SignupData";
import DuplicateEmailError from "@api/errors/DuplicateEmailError";
import { login } from "@api/utils";

@JsonController("/signup")
export class SignupController {
  @OnUndefined(204)
  @Post("/")
  async startSignup(
    @Body() data: SignupData
  ): Promise<PaymentFlowParams | undefined> {
    const baseForm = {
      email: data.email,
      password: await generatePassword(data.password)
    };

    if (data.contribution) {
      return await JoinFlowService.createPaymentJoinFlow(
        {
          ...baseForm,
          ...data.contribution,
          monthlyAmount: data.contribution.monthlyAmount
        },
        data,
        data.contribution.completeUrl,
        { email: data.email }
      );
    } else {
      const joinFlow = await JoinFlowService.createJoinFlow(baseForm, data);
      await JoinFlowService.sendConfirmEmail(joinFlow);
    }
  }

  @Post("/complete")
  async completeSignup(@Body() data: SignupCompleteData): Promise<void> {
    const joinFlow = await JoinFlowService.getJoinFlowByPaymentId(
      data.paymentFlowId
    );
    if (joinFlow) {
      await JoinFlowService.sendConfirmEmail(joinFlow);
    }
  }

  @OnUndefined(204)
  @Post("/confirm-email")
  async confirmEmail(
    @Req() req: Request,
    @Body() { joinFlowId }: SignupConfirmEmailParam
  ): Promise<void> {
    const joinFlow = await getRepository(JoinFlow).findOne(joinFlowId);
    if (!joinFlow) {
      throw new NotFoundError();
    }

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
      contributionType: ContributionType.None
    };
    let partialProfile: Partial<MemberProfile> = {};

    const completedFlow = await JoinFlowService.completeJoinFlow(joinFlow);

    if (completedFlow) {
      const paymentData = await PaymentService.customerToMember(
        joinFlow.joinForm.paymentMethod,
        completedFlow
      );

      Object.assign(partialMember, paymentData.partialMember);

      if (OptionsService.getBool("show-mail-opt-in")) {
        partialProfile.deliveryAddress = paymentData.billingAddress;
      }
    }

    if (member) {
      await MembersService.updateMember(member, partialMember);
      // Don't overwrite profile for an existing member
    } else {
      member = await MembersService.createMember(partialMember, partialProfile);
    }

    if (completedFlow) {
      await PaymentService.updatePaymentSource(member, completedFlow);
      await PaymentService.updateContribution(member, joinFlow.joinForm);
    }

    await EmailService.sendTemplateToMember("welcome", member);

    await login(req, member);
  }
}

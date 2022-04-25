import { Request } from "express";
import {
  BadRequestError,
  Body,
  JsonController,
  NotFoundError,
  OnUndefined,
  Post,
  Req
} from "routing-controllers";
import { getRepository } from "typeorm";

import {
  ContributionPeriod,
  ContributionType,
  PaymentMethod
} from "@core/utils";
import { generatePassword } from "@core/utils/auth";

import { NewsletterStatus } from "@core/providers/newsletter";

import EmailService from "@core/services/EmailService";
import GCPaymentService from "@core/services/GCPaymentService";
import JoinFlowService from "@core/services/JoinFlowService";
import MembersService from "@core/services/MembersService";
import OptionsService from "@core/services/OptionsService";

import JoinFlow from "@models/JoinFlow";
import MemberProfile from "@models/MemberProfile";
import ResetPasswordFlow from "@models/ResetPasswordFlow";

import {
  CompleteUrls,
  SignupCompleteData,
  SignupData,
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
  ): Promise<{ redirectUrl: string } | undefined> {
    const joinForm = {
      email: data.email,
      password: await generatePassword(data.password),
      // TODO: these should be optional
      monthlyAmount: data.contribution?.monthlyAmount || 0,
      period: data.contribution?.period || ContributionPeriod.Monthly,
      payFee: data.contribution?.payFee || false,
      prorate: false,
      paymentMethod: PaymentMethod.DirectDebit
    };

    if (data.contribution) {
      const { redirectUrl } = await JoinFlowService.createJoinFlow(
        joinForm,
        data.contribution.completeUrl,
        { email: data.email }
      );
      return {
        redirectUrl
      };
    } else if (data.complete) {
      const { joinFlow } = await JoinFlowService.createJoinFlow(joinForm);
      await this.sendConfirmEmail(joinFlow, data.complete);
    } else {
      throw new BadRequestError();
    }
  }

  @OnUndefined(204)
  @Post("/complete")
  async completeSignup(@Body() data: SignupCompleteData): Promise<void> {
    const joinFlow = await JoinFlowService.getJoinFlow(data.redirectFlowId);
    if (!joinFlow) {
      throw new NotFoundError();
    }

    await this.sendConfirmEmail(joinFlow, data);
  }

  private async sendConfirmEmail(joinFlow: JoinFlow, urls: CompleteUrls) {
    const member = await MembersService.findOne({
      email: joinFlow.joinForm.email
    });

    if (member?.membership?.isActive) {
      if (member.password.hash) {
        await EmailService.sendTemplateToMember("email-exists-login", member, {
          loginLink: urls.loginUrl
        });
      } else {
        const rpFlow = await getRepository(ResetPasswordFlow).save({ member });
        await EmailService.sendTemplateToMember(
          "email-exists-set-password",
          member,
          {
            spLink: urls.setPasswordUrl + "/" + rpFlow.id
          }
        );
      }
    } else {
      await EmailService.sendTemplateTo(
        "confirm-email",
        { email: joinFlow.joinForm.email },
        {
          firstName: "", // We don't know this yet
          confirmLink: urls.confirmUrl + "/" + joinFlow.id
        }
      );
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

    const completedJoinFlow = await JoinFlowService.completeJoinFlow(joinFlow);

    if (completedJoinFlow) {
      const gcData = await GCPaymentService.customerToMember(
        completedJoinFlow.customerId
      );

      Object.assign(partialMember, gcData.partialMember);

      if (OptionsService.getBool("show-mail-opt-in")) {
        partialProfile.deliveryAddress = gcData.billingAddress;
      }
    }

    if (member) {
      await MembersService.updateMember(member, partialMember);
      // Don't overwrite profile for an existing member
    } else {
      member = await MembersService.createMember(partialMember, partialProfile);
    }

    if (completedJoinFlow) {
      await GCPaymentService.updatePaymentSource(
        member,
        completedJoinFlow.customerId,
        completedJoinFlow.mandateId
      );
      await GCPaymentService.updateContribution(member, joinFlow.joinForm);
    }

    await EmailService.sendTemplateToMember("welcome", member);

    await login(req, member);
  }
}

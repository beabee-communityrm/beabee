import { IsEmail, Validate } from "class-validator";
import { Request } from "express";
import {
  Body,
  BodyParam,
  JsonController,
  NotFoundError,
  OnUndefined,
  Post,
  Req
} from "routing-controllers";
import { getRepository } from "typeorm";

import { generatePassword } from "@core/utils/auth";

import { NewsletterStatus } from "@core/providers/newsletter";

import EmailService from "@core/services/EmailService";
import GCPaymentService from "@core/services/GCPaymentService";
import JoinFlowService from "@core/services/JoinFlowService";
import MembersService from "@core/services/MembersService";
import OptionsService from "@core/services/OptionsService";

import JoinFlow from "@models/JoinFlow";

import { CompleteJoinFlowData } from "@api/data/JoinFlowData";
import { StartContributionData } from "@api/data/ContributionData";
import DuplicateEmailError from "@api/errors/DuplicateEmailError";
import IsPassword from "@api/validators/IsPassword";
import IsUrl from "@api/validators/IsUrl";
import { login } from "@api/utils";

class SignupData extends StartContributionData {
  @IsEmail()
  email!: string;

  @Validate(IsPassword)
  password!: string;
}

class SignupCompleteData extends CompleteJoinFlowData {
  @IsUrl()
  confirmUrl!: string;
}

@JsonController("/signup")
export class SignupController {
  @Post("/")
  async startSignup(
    @Body() data: SignupData
  ): Promise<{ redirectUrl: string }> {
    const redirectUrl = await JoinFlowService.createJoinFlow(
      data.completeUrl,
      {
        ...data,
        monthlyAmount: data.monthlyAmount,
        password: await generatePassword(data.password),
        prorate: false
      },
      { email: data.email }
    );
    return {
      redirectUrl
    };
  }

  @OnUndefined(204)
  @Post("/complete")
  async completeSignup(@Body() data: SignupCompleteData): Promise<void> {
    const joinFlow = await JoinFlowService.getJoinFlow(data.redirectFlowId);
    if (!joinFlow) {
      throw new NotFoundError();
    }

    await EmailService.sendTemplateTo(
      "confirm-email",
      { email: joinFlow.joinForm.email },
      {
        firstName: "", // We don't know this yet
        confirmLink: data.confirmUrl + "/" + joinFlow.id
      }
    );
  }

  @OnUndefined(204)
  @Post("/confirm-email")
  async confirmEmail(
    @Req() req: Request,
    @BodyParam("joinFlowId") joinFlowId: string
  ): Promise<void> {
    const joinFlow = await getRepository(JoinFlow).findOne(joinFlowId);
    if (!joinFlow) {
      throw new NotFoundError();
    }

    // Check for an existing active member first to avoid completing the join
    // flow unnecessarily
    let member = await MembersService.findOne({
      where: { email: joinFlow.joinForm.email },
      relations: ["profile"]
    });
    if (member && member.isActiveMember) {
      throw new DuplicateEmailError();
    }

    const { customerId, mandateId } = await JoinFlowService.completeJoinFlow(
      joinFlow
    );
    const { partialMember, partialProfile } =
      await GCPaymentService.customerToMember(customerId, joinFlow.joinForm);

    if (OptionsService.getText("newsletter-default-status") === "subscribed") {
      partialProfile.newsletterStatus = NewsletterStatus.Subscribed;
      partialProfile.newsletterGroups = OptionsService.getList(
        "newsletter-default-groups"
      );
    }

    if (member) {
      await MembersService.updateMember(member, partialMember);
      await MembersService.updateMemberProfile(member, partialProfile);
    } else {
      member = await MembersService.createMember(partialMember, partialProfile);
    }

    await GCPaymentService.updatePaymentSource(member, customerId, mandateId);
    await GCPaymentService.updateContribution(member, joinFlow.joinForm);

    await EmailService.sendTemplateToMember("welcome", member);

    await login(req, member);
  }
}

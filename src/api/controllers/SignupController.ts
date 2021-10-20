import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsString,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface
} from "class-validator";
import { Request } from "express";
import {
  BadRequestError,
  Body,
  BodyParam,
  JsonController,
  NotFoundError,
  OnUndefined,
  Post,
  Req
} from "routing-controllers";
import { getRepository } from "typeorm";

import { ContributionPeriod } from "@core/utils";
import { generatePassword } from "@core/utils/auth";

import { NewsletterStatus } from "@core/providers/newsletter";

import EmailService from "@core/services/EmailService";
import GCPaymentService from "@core/services/GCPaymentService";
import JoinFlowService from "@core/services/JoinFlowService";
import MembersService from "@core/services/MembersService";
import OptionsService from "@core/services/OptionsService";

import JoinFlow from "@models/JoinFlow";

@ValidatorConstraint({ name: "minContributionAmount" })
class MinContributionAmount implements ValidatorConstraintInterface {
  validate(amount: unknown, args: ValidationArguments): boolean {
    return typeof amount === "number" && amount >= this.minAmount(args);
  }

  defaultMessage(args: ValidationArguments) {
    return `${args.property} must be at least ${this.minAmount(args)}`;
  }

  private minAmount(args: ValidationArguments) {
    const period = (args.object as SignupData).period as unknown;
    return (
      OptionsService.getInt("contribution-min-monthly-amount") *
      (period === ContributionPeriod.Annually ? 12 : 1)
    );
  }
}

@ValidatorConstraint({ name: "isPassword" })
class IsPassword implements ValidatorConstraintInterface {
  validate(password: unknown): boolean | Promise<boolean> {
    return (
      typeof password === "string" &&
      password.length >= 8 &&
      /[a-z]/.test(password) &&
      /[A-Z]/.test(password) &&
      /[0-9]/.test(password)
    );
  }

  defaultMessage(args: ValidationArguments) {
    return `${args.property} does not meet password requirements`;
  }
}

class SignupData {
  @IsEmail()
  email!: string;

  @Validate(IsPassword)
  password!: string;

  @Validate(MinContributionAmount)
  amount!: number;

  @IsEnum(ContributionPeriod)
  period!: ContributionPeriod;

  @IsBoolean()
  payFee!: boolean;

  @IsString()
  completeUrl!: string;
}

class SignupCompleteData {
  @IsString()
  redirectFlowId!: string;

  @IsString()
  confirmUrl!: string;
}

@JsonController("/signup")
export class SignupController {
  @Post("/")
  async startSignup(
    @Body({ required: true }) data: SignupData
  ): Promise<{ redirectUrl: string }> {
    const redirectUrl = await JoinFlowService.createJoinFlow(
      data.completeUrl,
      {
        ...data,
        monthlyAmount:
          data.period === ContributionPeriod.Monthly
            ? data.amount
            : data.amount / 12,
        password: await generatePassword(data.password),
        prorate: false
      },
      {
        prefilled_customer: {
          email: data.email
        }
      }
    );
    return {
      redirectUrl
    };
  }

  @OnUndefined(204)
  @Post("/complete")
  async completeSignup(
    @Body({ required: true }) data: SignupCompleteData
  ): Promise<void> {
    const joinFlow = await getRepository(JoinFlow).findOne({
      redirectFlowId: data.redirectFlowId
    });
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
    @BodyParam("joinFlowId", { required: true }) joinFlowId: string
  ): Promise<void> {
    const joinFlow = await getRepository(JoinFlow).findOne(joinFlowId);
    if (!joinFlow) {
      throw new NotFoundError();
    }

    // Check for an existing active member first to avoid completing the join
    // flow unnecessarily
    let member = await MembersService.findOne({
      email: joinFlow.joinForm.email
    });
    if (member && member.isActiveMember) {
      // TODO: set errors properly
      const error = new BadRequestError() as any;
      error.code = "duplicate-email";
      throw error;
    }

    const completedJoinFlow = await JoinFlowService.completeJoinFlow(joinFlow);
    const { partialMember, partialProfile } =
      await GCPaymentService.customerToMember(completedJoinFlow);

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

    await GCPaymentService.updatePaymentMethod(
      member,
      completedJoinFlow.customerId,
      completedJoinFlow.mandateId
    );
    await GCPaymentService.updateContribution(
      member,
      completedJoinFlow.joinForm
    );

    await EmailService.sendTemplateToMember("welcome", member);

    // For now use existing session infrastructure with a cookie
    await new Promise<void>((resolve, reject) => {
      req.login(member!, (error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
}

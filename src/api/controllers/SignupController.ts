import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNumber,
  IsString,
  Validate,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface
} from "class-validator";
import { Request } from "express";
import {
  Body,
  BodyParam,
  HttpError,
  JsonController,
  NotFoundError,
  OnUndefined,
  Post,
  Req
} from "routing-controllers";

import { ContributionPeriod, isDuplicateIndex } from "@core/utils";
import { generatePassword } from "@core/utils/auth";

import { NewsletterStatus } from "@core/providers/newsletter";

import EmailService from "@core/services/EmailService";
import GCPaymentService from "@core/services/GCPaymentService";
import JoinFlowService, {
  CompletedJoinFlow
} from "@core/services/JoinFlowService";
import MembersService from "@core/services/MembersService";

import Member from "@models/Member";

import IsPassword from "@api/validators/IsPassword";
import MinContributionAmount from "@api/validators/MinContributionAmount";
import { login } from "@api/utils";

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

type SignupErrorCode =
  | "duplicate-email"
  | "confirm-email"
  | "restart-membership"
  | "confirm-email-failed";

class SignupError extends HttpError {
  constructor(readonly code: SignupErrorCode) {
    super(400);
    Object.setPrototypeOf(this, SignupError.prototype);
  }

  toJSON() {
    return {
      status: 400,
      code: this.code
    };
  }
}

interface SignupStart {
  redirectUrl: string;
}

async function handleJoin(
  req: Request,
  member: Member,
  joinFlow: CompletedJoinFlow
): Promise<void> {
  await GCPaymentService.updatePaymentMethod(
    member,
    joinFlow.customerId,
    joinFlow.mandateId
  );
  await GCPaymentService.updateContribution(member, joinFlow.joinForm);

  await MembersService.updateMember(member, { activated: true });
  if (OptionsService.getText("newsletter-default-status") === "subscribed") {
    await MembersService.updateMemberProfile(member, {
      newsletterStatus: NewsletterStatus.Subscribed,
      newsletterGroups: OptionsService.getList("newsletter-default-groups")
    });
  }

  await EmailService.sendTemplateToMember("welcome", member);

  await login(req, member);
}

@JsonController("/signup")
export class SignupController {
  @Post("/")
  async startSignup(
    @Body({ required: true }) data: SignupData
  ): Promise<SignupStart> {
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
    @Req() req: Request,
    @BodyParam("redirectFlowId", { required: true }) redirectFlowId: string
  ): Promise<void> {
    const joinFlow = await JoinFlowService.completeJoinFlow(redirectFlowId);
    if (!joinFlow) {
      throw new NotFoundError();
    }

    const { partialMember, partialProfile } =
      await GCPaymentService.customerToMember(joinFlow);

    try {
      const newMember = await MembersService.createMember(
        partialMember,
        partialProfile
      );
      await handleJoin(req, newMember, joinFlow);
    } catch (error) {
      if (isDuplicateIndex(error, "email")) {
        const oldMember = await MembersService.findOne({
          email: partialMember.email
        });
        // This should never be able to happen
        if (!oldMember) {
          throw error;
        }

        if (oldMember.isActiveMember) {
          throw new SignupError("duplicate-email");
        } else {
          const restartFlow = await JoinFlowService.createRestartFlow(
            oldMember,
            joinFlow
          );
          await EmailService.sendTemplateToMember(
            "join-confirm-email",
            oldMember,
            { code: restartFlow.id }
          );
          throw new SignupError(
            oldMember.activated ? "restart-membership" : "confirm-email"
          );
        }
      } else {
        throw error;
      }
    }
  }

  @OnUndefined(204)
  @Post("/confirm-email")
  async confirmEmail(
    @Req() req: Request,
    @BodyParam("restartFlowId", { required: true }) restartFlowId: string
  ): Promise<void> {
    const restartFlow = await JoinFlowService.completeRestartFlow(
      restartFlowId
    );
    if (!restartFlow) {
      throw new NotFoundError();
    }

    if (restartFlow.member.isActiveMember) {
      throw new SignupError("confirm-email-failed");
    } else {
      await handleJoin(req, restartFlow.member, restartFlow);
    }
  }
}

import { Type } from "class-transformer";
import {
  IsBoolean,
  IsDefined,
  IsEmail,
  IsEnum,
  IsString,
  ValidateNested,
  ValidationError
} from "class-validator";
import {
  BadRequestError,
  Body,
  CurrentUser,
  Get,
  JsonController,
  NotFoundError,
  OnUndefined,
  Post,
  Put
} from "routing-controllers";
import { getRepository } from "typeorm";

import { NewsletterStatus } from "@core/providers/newsletter";

import GCPaymentService from "@core/services/GCPaymentService";
import JoinFlowService from "@core/services/JoinFlowService";
import MembersService from "@core/services/MembersService";
import PaymentService, { PaymentSource } from "@core/services/PaymentService";

import { ContributionPeriod } from "@core/utils";
import { generatePassword } from "@core/utils/auth";

import Address from "@models/Address";
import JoinFlow from "@models/JoinFlow";
import Member from "@models/Member";
import MemberProfile from "@models/MemberProfile";

import config from "@config";

import IsUrl from "@api/validators/IsUrl";
import DuplicateEmailError from "@api/errors/DuplicateEmailError";
import CantUpdateContribution from "@api/errors/CantUpdateContribution";

interface MemberData {
  email: string;
  firstname: string;
  lastname: string;
}

interface MemberProfileData {
  deliveryOptIn: boolean;
  deliveryAddress?: Address;
  newsletterStatus: NewsletterStatus;
}

interface GetMemberData extends MemberData {
  joined: Date;
  contributionAmount?: number;
  contributionPeriod?: ContributionPeriod;
  contributionCurrencyCode?: string;
  profile: MemberProfileData;
}

class UpdateAddressData implements Address {
  @IsDefined()
  @IsString()
  line1!: string;

  @IsString()
  line2?: string;

  @IsDefined()
  @IsString()
  city!: string;

  @IsDefined()
  @IsString()
  postcode!: string;
}

class UpdateMemberProfileData implements Partial<MemberProfileData> {
  @IsBoolean()
  deliveryOptIn?: boolean;

  @ValidateNested()
  @Type(() => UpdateAddressData)
  deliveryAddress?: UpdateAddressData;

  @IsEnum(NewsletterStatus)
  newsletterStatus?: NewsletterStatus;
}

class UpdateMemberData implements Partial<MemberData> {
  @IsEmail()
  email?: string;

  @IsString()
  firstname?: string;

  @IsString()
  lastname?: string;

  @IsString()
  password?: string;

  @ValidateNested()
  @Type(() => UpdateMemberProfileData)
  profile?: UpdateMemberProfileData;
}

class UpsertPaymentSourceData {
  @IsUrl()
  completeUrl!: string;
}

class UpsertPaymentSourceCompleteData {
  @IsString()
  redirectFlowId!: string;
}

async function memberToApiMember(member: Member): Promise<GetMemberData> {
  const profile = await getRepository(MemberProfile).findOneOrFail({ member });

  return {
    email: member.email,
    firstname: member.firstname,
    lastname: member.lastname,
    profile: {
      deliveryOptIn: !!profile.deliveryOptIn,
      deliveryAddress: profile.deliveryAddress,
      newsletterStatus: profile.newsletterStatus
    },
    joined: member.joined,
    contributionPeriod: member.contributionPeriod,
    ...(member.contributionMonthlyAmount !== undefined && {
      contributionAmount:
        member.contributionMonthlyAmount *
        (member.contributionPeriod === ContributionPeriod.Monthly ? 1 : 12),
      contributionCurrencyCode: config.currencyCode
    })
  };
}

@JsonController("/member")
export class MemberController {
  @Get("/me")
  async getMe(
    @CurrentUser({ required: true }) member: Member
  ): Promise<GetMemberData> {
    return await memberToApiMember(member);
  }

  @Put("/me")
  async updateMe(
    @CurrentUser({ required: true }) member: Member,
    @Body({ required: true, validate: { skipMissingProperties: true } })
    data: UpdateMemberData
  ): Promise<GetMemberData> {
    if (data.email || data.firstname || data.lastname || data.password) {
      await MembersService.updateMember(member, {
        ...(data.email && { email: data.email }),
        ...(data.firstname && { firstname: data.firstname }),
        ...(data.lastname && { lastname: data.lastname }),
        ...(data.password && {
          password: await generatePassword(data.password)
        })
      });
    }

    if (data.profile) {
      await MembersService.updateMemberProfile(member, data.profile);
    }

    return await memberToApiMember(member);
  }

  @Get("/member/me/payment-source")
  async getPaymentSource(
    @CurrentUser({ required: true }) member: Member
  ): Promise<PaymentSource | undefined> {
    return await PaymentService.getPaymentSource(member);
  }

  @Put("/member/me/payment-source")
  async setPaymentSource(
    @CurrentUser({ required: true }) member: Member,
    @Body({ required: true }) data: UpsertPaymentSourceData
  ): Promise<{ redirectUrl: string }> {
    if (!(await GCPaymentService.canChangeContribution(member, false))) {
      throw new CantUpdateContribution();
    }

    const redirectUrl = await JoinFlowService.createJoinFlow(
      data.completeUrl,
      // TODO: this is all unnecessary, we should remove this
      {
        monthlyAmount: 0,
        period: ContributionPeriod.Monthly,
        password: await generatePassword(""),
        email: "",
        payFee: true,
        prorate: false
      },
      {
        prefilled_customer: {
          email: member.email,
          given_name: member.firstname,
          family_name: member.lastname
        }
      }
    );
    return {
      redirectUrl
    };
  }

  @OnUndefined(204)
  @Post("/member/me/payment-source/complete")
  async completePaymentSource(
    @CurrentUser({ required: true }) member: Member,
    @Body({ required: true }) data: UpsertPaymentSourceCompleteData
  ): Promise<void> {
    if (!(await GCPaymentService.canChangeContribution(member, false))) {
      throw new CantUpdateContribution();
    }

    const joinFlow = await getRepository(JoinFlow).findOne({
      redirectFlowId: data.redirectFlowId
    });
    if (!joinFlow) {
      throw new NotFoundError();
    }

    const { customerId, mandateId } = await JoinFlowService.completeJoinFlow(
      joinFlow
    );
    await GCPaymentService.updatePaymentMethod(member, customerId, mandateId);
  }
}

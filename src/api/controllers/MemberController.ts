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
  Put
} from "routing-controllers";
import { getRepository } from "typeorm";

import { NewsletterStatus } from "@core/providers/newsletter";

import MembersService from "@core/services/MembersService";
import PaymentService, { PaymentSource } from "@core/services/PaymentService";

import { ContributionPeriod } from "@core/utils";
import { generatePassword } from "@core/utils/auth";

import Address from "@models/Address";
import Member from "@models/Member";
import MemberProfile from "@models/MemberProfile";

import config from "@config";

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
}

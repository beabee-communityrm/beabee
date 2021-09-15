import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsObject,
  IsOptional,
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

import { ContributionPeriod, isDuplicateIndex } from "@core/utils";
import { generatePassword } from "@core/utils/auth";

import Address from "@models/Address";
import Member from "@models/Member";
import MemberProfile from "@models/MemberProfile";

class MemberProfileData {
  @IsBoolean()
  deliveryOptIn!: boolean;

  @IsOptional()
  @IsObject()
  deliveryAddress?: Address;

  @IsEnum(NewsletterStatus)
  newsletterStatus!: NewsletterStatus;
}

interface MemberData {
  email: string;
  firstname: string;
  lastname: string;
  profile: MemberProfileData;
}

interface GetMemberData extends MemberData {
  joined: Date;
  contributionAmount?: number;
  contributionPeriod?: ContributionPeriod;
}

class UpdateMemberData implements MemberData {
  @IsEmail()
  email!: string;

  @IsString()
  firstname!: string;

  @IsString()
  lastname!: string;

  @IsString()
  password!: string;

  @ValidateNested()
  profile!: MemberProfileData;
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
    contributionAmount:
      member.contributionMonthlyAmount &&
      member.contributionMonthlyAmount *
        (member.contributionPeriod === ContributionPeriod.Monthly ? 1 : 12)
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
    @Body() data: Partial<UpdateMemberData>
  ): Promise<GetMemberData> {
    try {
      await MembersService.updateMember(member, {
        ...(data.email && { email: data.email }),
        ...(data.firstname && { firstname: data.firstname }),
        ...(data.lastname && { lastname: data.lastname }),
        ...(data.password && {
          password: await generatePassword(data.password)
        })
      });
    } catch (error) {
      if (isDuplicateIndex(error, "email")) {
        const duplicateEmailError: any = new BadRequestError();
        duplicateEmailError.errors = [
          {
            property: "email",
            constraints: {
              "duplicate-email": "Email address already in use"
            }
          }
        ] as ValidationError[];
        throw duplicateEmailError;
      } else {
        throw error;
      }
    }

    if (data.profile) {
      await MembersService.updateMemberProfile(member, data.profile);
    }

    return await memberToApiMember(member);
  }
}

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
import { Request, Response } from "express";
import {
  BadRequestError,
  Body,
  CurrentUser,
  Get,
  JsonController,
  Put,
  Req,
  Res,
  UnauthorizedError
} from "routing-controllers";
import { Brackets, createQueryBuilder, getRepository } from "typeorm";

import { NewsletterStatus } from "@core/providers/newsletter";

import MembersService from "@core/services/MembersService";

import { ContributionPeriod, isDuplicateIndex } from "@core/utils";
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
    try {
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
    } catch (error: any) {
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

  @Get("/stats")
  async stats(
    @Req() req: Request,
    @Res() res: Response
  ): Promise<{ total: number }> {
    if (req.headers.origin) {
      if (config.trackDomains.indexOf(req.headers.origin) === -1) {
        throw new UnauthorizedError();
      } else {
        res.set("Access-Control-Allow-Origin", req.headers.origin);
      }
    }

    const total = await createQueryBuilder(Member, "m")
      .innerJoin("m.permissions", "mp")
      .andWhere("mp.permission = 'member' AND mp.dateAdded <= :now")
      .andWhere(
        new Brackets((qb) => {
          qb.where("mp.dateExpires IS NULL").orWhere("mp.dateExpires > :now");
        })
      )
      .setParameters({ now: new Date() })
      .getCount();

    return { total };
  }
}

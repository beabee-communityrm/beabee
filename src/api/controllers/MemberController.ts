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

import { isDuplicateIndex } from "@core/utils";

import Address from "@models/Address";
import Member from "@models/Member";
import MemberProfile from "@models/MemberProfile";

import config from "@config";

class MemberProfileData {
  @IsBoolean()
  deliveryOptIn!: boolean;

  @IsOptional()
  @IsObject()
  deliveryAddress?: Address;

  @IsEnum(NewsletterStatus)
  newsletterStatus!: NewsletterStatus;
}

class MemberData {
  @IsEmail()
  email!: string;

  @IsString()
  firstname!: string;

  @IsString()
  lastname!: string;

  @ValidateNested()
  profile!: MemberProfileData;
}

async function memberToApiMember(member: Member): Promise<MemberData> {
  const profile = await getRepository(MemberProfile).findOneOrFail({ member });

  return {
    email: member.email,
    firstname: member.firstname,
    lastname: member.lastname,
    profile: {
      deliveryOptIn: !!profile.deliveryOptIn,
      deliveryAddress: profile.deliveryAddress,
      newsletterStatus: profile.newsletterStatus
    }
  };
}

@JsonController("/member")
export class MemberController {
  @Get("/me")
  async getMe(
    @CurrentUser({ required: true }) member: Member
  ): Promise<MemberData> {
    return await memberToApiMember(member);
  }

  @Put("/me")
  async updateMe(
    @CurrentUser({ required: true }) member: Member,
    @Body() data: Partial<MemberData>
  ): Promise<MemberData> {
    if (data.email || data.firstname || data.lastname) {
      try {
        await MembersService.updateMember(member, {
          email: data.email,
          firstname: data.firstname,
          lastname: data.lastname
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

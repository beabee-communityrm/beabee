import { IsEmail, isUUID, Validate } from "class-validator";
import { Request, Response } from "express";
import {
  Body,
  Get,
  JsonController,
  NotFoundError,
  OnUndefined,
  Param,
  Post,
  Req,
  Res,
  UnauthorizedError
} from "routing-controllers";
import { getRepository } from "typeorm";

import passport from "@core/lib/passport";

import MembersService from "@core/services/MembersService";

import Member from "@models/Member";
import MemberPermission, {
  PermissionType,
  PermissionTypes
} from "@models/MemberPermission";

import IsPassword from "@api/validators/IsPassword";

import config from "@config";

class LoginData {
  @IsEmail()
  email!: string;

  @Validate(IsPassword)
  password!: string;
}

@JsonController("/login")
export class LoginController {
  @OnUndefined(204)
  @Post("/")
  async login(
    @Req() req: Request,
    @Res() res: Response,
    // Just used for validation (email and password are in passport strategy)
    @Body({ required: true }) data: LoginData
  ): Promise<void> {
    await new Promise<void>((resolve, reject) => {
      passport.authenticate("local", (err, user, info) => {
        if (err || !user) {
          const error = new UnauthorizedError() as any;
          if (info?.message) {
            error.code = info.message;
          }
          reject(error);
        } else {
          // For some reason we need to call this again to set the cookie
          req.login(user, (err) => resolve());
        }
      })(req, res);
    });
  }

  @OnUndefined(204)
  @Get("/as/:id")
  async loginAs(@Req() req: Request, @Param("id") id: string) {
    if (!config.dev) {
      throw new NotFoundError();
    }

    let member: Member | undefined;
    if (PermissionTypes.indexOf(id as PermissionType) > -1) {
      const permission = await getRepository(MemberPermission).findOne({
        where: { permission: id },
        relations: ["member"]
      });
      member = permission?.member;
    } else if (isUUID(id)) {
      member = await MembersService.findOne(id);
    }

    if (member) {
      await new Promise<void>((resolve, reject) => {
        req.login(member!, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    } else {
      throw new NotFoundError();
    }
  }
}

import { IsEmail, IsString, isUUID } from "class-validator";
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

import { login } from "@api/utils";

import config from "@config";

class LoginData {
  @IsEmail()
  email!: string;

  // We deliberately don't vaidate with IsPassword here so
  // invalid passwords return a 401
  @IsString()
  password!: string;
}

@JsonController("/auth")
export class AuthController {
  @OnUndefined(204)
  @Post("/login")
  async login(
    @Req() req: Request,
    @Res() res: Response,
    // Just used for validation (email and password are in passport strategy)
    @Body({ required: true }) data: LoginData
  ): Promise<void> {
    await new Promise<Member>((resolve, reject) => {
      passport.authenticate("local", (err, user, info) => {
        if (err || !user) {
          const error = new UnauthorizedError() as any;
          if (info?.message) {
            error.code = info.message;
          }
          reject(error);
        } else {
          resolve(user);
        }
      })(req, res);
    }).then((user) => login(req, user)); // Why do we have to login after authenticate?
  }

  @OnUndefined(204)
  @Get("/login/as/:id")
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
      await login(req, member);
    } else {
      throw new NotFoundError();
    }
  }

  @OnUndefined(204)
  @Post("/logout")
  logout(@Req() req: Request): void {
    req.logout();
  }
}

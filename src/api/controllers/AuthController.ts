import { PermissionTypes, PermissionType } from "@beabee/beabee-common";
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

import ContactsService from "@core/services/ContactsService";

import Contact from "@models/Contact";
import ContactRole from "@models/ContactRole";

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
    @Body() data: LoginData
  ): Promise<void> {
    await new Promise<Contact>((resolve, reject) => {
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

    let contact: Contact | undefined;
    if (PermissionTypes.indexOf(id as PermissionType) > -1) {
      const permission = await getRepository(ContactRole).findOne({
        where: { permission: id },
        relations: ["member"]
      });
      contact = permission?.member;
    } else if (isUUID(id, "4")) {
      contact = await ContactsService.findOne(id);
    }

    if (contact) {
      await login(req, contact);
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

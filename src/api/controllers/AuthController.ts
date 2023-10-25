import { RoleTypes, RoleType } from "@beabee/beabee-common";
import { IsEmail, IsString, isUUID, IsOptional } from "class-validator";
import { Request, Response } from "express";
import {
  Body,
  Get,
  HttpError,
  JsonController,
  NotFoundError,
  OnUndefined,
  Param,
  Post,
  Req,
  Res
} from "routing-controllers";
import { getRepository } from "typeorm";

import { UnauthorizedError } from "../errors/UnauthorizedError";

import passport from "@core/lib/passport";

import ContactsService from "@core/services/ContactsService";
import ContactMfaService from "@core/services/ContactMfaService";

import Contact from "@models/Contact";
import ContactRole from "@models/ContactRole";

import { login } from "@api/utils";

import {
  LOGIN_CODES,
  PassportLoginInfo
} from "@api/data/ContactData/interface";

import config from "@config";

class LoginData {
  @IsEmail()
  email!: string;

  // We deliberately don't validate with IsPassword here so
  // invalid passwords return a 401
  @IsString()
  password!: string;

  /** Optional multi factor authentication token */
  @IsString()
  @IsOptional()
  token?: string;
}

@JsonController("/auth")
export class AuthController {
  @OnUndefined(204)
  @Post("/login")
  async login(
    @Req() req: Request,
    @Res() res: Response,
    /**
     * `email` and `password` just used for validation (email and password are in passport strategy)
     * `token` is used for multi factor authentication
     */
    @Body() data: LoginData
  ): Promise<void> {
    const user = await new Promise<Contact>((resolve, reject) => {
      passport.authenticate(
        "local",
        async (err: null, user: Contact | false, info?: PassportLoginInfo) => {
          if (err || !user) {
            // Unknown error
            return reject(
              new UnauthorizedError({
                code: info?.message || LOGIN_CODES.LOGIN_FAILED
              })
            );
          }

          // If user has 2FA enabled, check token
          if (info?.message === LOGIN_CODES.REQUIRES_2FA) {
            // If user has no token, notify client that 2FA is required
            if (!data.token) {
              return reject(
                new UnauthorizedError({ code: LOGIN_CODES.REQUIRES_2FA })
              );
            }

            // Check token
            const { isValid, delta } = await ContactMfaService.checkToken(
              user,
              data.token,
              1
            );
            if (!isValid) {
              return reject(
                new UnauthorizedError({
                  code: LOGIN_CODES.WRONG_2FA_TOKEN,
                  message: "Wrong 2FA token" + delta ? ` (delta: ${delta})` : ""
                })
              );
            }
          }

          resolve(user);
        }
      )(req, res);
    });

    await login(req, user); // Why do we have to login after authenticate?
  }

  @OnUndefined(204)
  @Get("/login/as/:id")
  async loginAs(@Req() req: Request, @Param("id") id: string) {
    if (!config.dev) {
      throw new NotFoundError();
    }

    let contact: Contact | undefined;
    if (RoleTypes.indexOf(id as RoleType) > -1) {
      const role = await getRepository(ContactRole).findOne({
        where: { type: id },
        relations: ["contact"]
      });
      contact = role?.contact;
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
  async logout(@Req() req: Request): Promise<void> {
    await new Promise<void>((resolve, reject) =>
      req.logout((err) => {
        if (err) reject(err);
        else resolve();
      })
    );
  }
}

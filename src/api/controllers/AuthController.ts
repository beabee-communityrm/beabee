import { RoleTypes, RoleType } from "@beabee/beabee-common";
import { isUUID } from "class-validator";
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

import { UnauthorizedError } from "../errors/UnauthorizedError";

import { getRepository } from "@core/database";
import passport from "@core/lib/passport";

import ContactsService from "@core/services/ContactsService";

import { LoginDto } from "@api/dto/LoginDto";
import { login } from "@api/utils";

import Contact from "@models/Contact";
import ContactRole from "@models/ContactRole";

import { LOGIN_CODES } from "@enums/login-codes";

import { PassportLoginInfo } from "@type/passport-login-info";

import config from "@config";

@JsonController("/auth")
export class AuthController {
  @OnUndefined(204)
  @Post("/login")
  async login(
    @Req() req: Request,
    @Res() res: Response,
    /** Just used for validation (`email`, `password` and `req.data.token` are in passport strategy) */
    @Body() _: LoginDto
  ): Promise<void> {
    const user = await new Promise<Contact>((resolve, reject) => {
      passport.authenticate(
        "local",
        async (
          err: null | HttpError | UnauthorizedError,
          user: Contact | false,
          info?: PassportLoginInfo
        ) => {
          // Forward HTTP errors
          if (err) {
            if (err instanceof HttpError) {
              // Passport errors only have a `message` property, so we handle the message as code
              if (err instanceof UnauthorizedError) {
                err.code ||= err.message || LOGIN_CODES.LOGIN_FAILED;
              }

              return reject(err);
            }
          }

          // Unknown errors
          if (err || !user) {
            return reject(
              new UnauthorizedError({
                code: info?.message || LOGIN_CODES.LOGIN_FAILED,
                message: info?.message || LOGIN_CODES.LOGIN_FAILED
              })
            );
          }

          // Looks good, return user
          resolve(user);
        }
      )(req, res);
    });

    // If there is no error thrown, login
    await login(req, user); // Why do we have to login after authenticate?
  }

  @OnUndefined(204)
  @Get("/login/as/:id")
  async loginAs(@Req() req: Request, @Param("id") id: string): Promise<void> {
    if (!config.dev) {
      throw new NotFoundError();
    }

    let contact: Contact | undefined;
    if (RoleTypes.indexOf(id as RoleType) > -1) {
      const role = await getRepository(ContactRole).findOne({
        where: { type: id as RoleType },
        relations: { contact: true }
      });
      contact = role?.contact;
    } else if (isUUID(id, "4")) {
      contact = await ContactsService.findOneBy({ id });
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

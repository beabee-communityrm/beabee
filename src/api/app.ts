import { RoleType } from "@beabee/beabee-common";
import AppUser from "@models/AppUser";
import cookie from "cookie-parser";
import crypto from "crypto";
import express, { ErrorRequestHandler, Request } from "express";
import "module-alias/register";
import "reflect-metadata";
import {
  Action,
  HttpError,
  InternalServerError,
  NotFoundError,
  useExpressServer
} from "routing-controllers";

import * as db from "@core/database";
import { log, requestErrorLogger, requestLogger } from "@core/logging";
import startServer from "@core/server";
import ApiUsersService from "@core/services/ApiUsersService";
import sessions from "@core/sessions";

import { ApiUserController } from "./controllers/ApiUserController";
import { AuthController } from "./controllers/AuthController";
import { CalloutController } from "./controllers/CalloutController";
import { CalloutResponseCommentController } from "./controllers/CalloutResponseCommentController";
import { CalloutResponseController } from "./controllers/CalloutResponseController";
import { ContactController } from "./controllers/ContactController";
import { ContentController } from "./controllers/ContentController";
import { EmailController } from "./controllers/EmailController";
import { NoticeController } from "./controllers/NoticeController";
import { ResetPasswordController } from "./controllers/ResetPasswordController";
import { SegmentController } from "./controllers/SegmentController";
import { SignupController } from "./controllers/SignupController";
import { StatsController } from "./controllers/StatsController";

async function currentUserChecker(
  action: Action
): Promise<AppUser | undefined> {
  if (action.request.user) {
    return action.request.user;
  }
  if (action.request.headers.authorization) {
    const [type, token] = action.request.headers.authorization.split(" ");
    if (type === "Bearer") {
      const [id, secret] = token.split("_");
      const secretHash = crypto
        .createHash("sha256")
        .update(secret)
        .digest("hex");
      const apiUser = await ApiUsersService.findOne(secretHash);

      return apiUser;
    }
  }
}

async function authorizationChecker(
  action: Action,
  roles: RoleType[]
): Promise<boolean> {
  const user = await currentUserChecker(action);
  return !!user && roles.every((role) => user.hasRole(role));
}

const app = express();

app.use(requestLogger);

app.use(cookie());

db.connect().then(() => {
  sessions(app);

  useExpressServer(app, {
    routePrefix: "/1.0",
    controllers: [
      ApiUserController,
      AuthController,
      CalloutController,
      CalloutResponseController,
      CalloutResponseCommentController,
      ContactController,
      ContentController,
      EmailController,
      NoticeController,
      ResetPasswordController,
      SegmentController,
      SignupController,
      StatsController
    ],
    currentUserChecker,
    authorizationChecker,
    validation: {
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      whitelist: true,
      validationError: {
        target: false,
        value: false
      }
    },
    defaults: {
      paramOptions: {
        required: true
      }
    },
    defaultErrorHandler: false
  });

  app.use((req, res) => {
    if (!res.headersSent) {
      throw new NotFoundError();
    }
  });

  app.use(function (error, req, res, next) {
    if (error instanceof HttpError) {
      res.status(error.httpCode).send(error);
    } else {
      log.error("Unhandled error: ", error);
      res.status(500).send(new InternalServerError("Unhandled error"));
    }
  } as ErrorRequestHandler);

  app.use(requestErrorLogger);

  startServer(app);
});

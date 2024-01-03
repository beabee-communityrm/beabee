import "module-alias/register";
import "reflect-metadata";

import { RoleType } from "@beabee/beabee-common";
import cookie from "cookie-parser";
import cors from "cors";
import express, { ErrorRequestHandler } from "express";
import {
  Action,
  HttpError,
  InternalServerError,
  NotFoundError,
  useExpressServer
} from "routing-controllers";

import { ApiKeyController } from "./controllers/ApiKeyController";
import { AuthController } from "./controllers/AuthController";
import { CalloutController } from "./controllers/CalloutController";
import { CalloutResponseController } from "./controllers/CalloutResponseController";
import { CalloutResponseCommentController } from "./controllers/CalloutResponseCommentController";
import { ContentController } from "./controllers/ContentController";
import { EmailController } from "./controllers/EmailController";
import { ContactController } from "./controllers/ContactController";
import { NoticeController } from "./controllers/NoticeController";
import { PaymentController } from "./controllers/PaymentController";
import { SegmentController } from "./controllers/SegmentController";
import { SignupController } from "./controllers/SignupController";
import { StatsController } from "./controllers/StatsController";
import { ResetPasswordController } from "./controllers/ResetPasswordController";
import { ResetDeviceController } from "./controllers/ResetDeviceController";
import { UploadController } from "./controllers/UploadController";

import { ValidateResponseInterceptor } from "./interceptors/ValidateResponseInterceptor";

import {
  log as mainLogger,
  requestErrorLogger,
  requestLogger
} from "@core/logging";
import sessions from "@core/sessions";
import { initApp, startServer } from "@core/server";

import AuthService from "@core/services/AuthService";

import config from "@config";

async function currentUserChecker(action: Action) {
  const apiKeyOrContact = await AuthService.check(action.request);
  // API key isn't a user
  return apiKeyOrContact === true ? undefined : apiKeyOrContact;
}

async function authorizationChecker(action: Action, roles: RoleType[]) {
  const apiKeyOrContact = await AuthService.check(action.request);
  // API key has superadmin abilities
  return apiKeyOrContact === true
    ? true
    : roles.every((role) => apiKeyOrContact?.hasRole(role));
}

const app = express();

app.use(requestLogger);

app.use(cors({ origin: config.trustedOrigins }));

app.use(cookie());

initApp()
  .then(() => {
    sessions(app);

    useExpressServer(app, {
      routePrefix: "/1.0",
      controllers: [
        ApiKeyController,
        AuthController,
        CalloutController,
        CalloutResponseController,
        CalloutResponseCommentController,
        ContentController,
        EmailController,
        ContactController,
        NoticeController,
        PaymentController,
        SegmentController,
        SignupController,
        StatsController,
        ResetPasswordController,
        ResetDeviceController,
        UploadController
      ],
      interceptors: [ValidateResponseInterceptor],
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

    const log = mainLogger.child({ app: "response" });

    app.use(function (error, req, res, next) {
      if (error instanceof HttpError && error.httpCode < 500) {
        res.status(error.httpCode).send(error);
        if (error.httpCode === 400) {
          log.notice(error);
        }
      } else {
        log.error("Unhandled error: ", error);
        res.status(500).send(new InternalServerError("Unhandled error"));
      }
    } as ErrorRequestHandler);

    app.use(requestErrorLogger);

    startServer(app);
  })
  .catch((err) => {
    mainLogger.error("Error during initialization", err);
  });

import "module-alias/register";
import "reflect-metadata";

import { RoleType } from "@beabee/beabee-common";
import cookie from "cookie-parser";
import cors from "cors";
import crypto from "crypto";
import express, { ErrorRequestHandler, Request } from "express";
import {
  Action,
  HttpError,
  InternalServerError,
  NotFoundError,
  useExpressServer
} from "routing-controllers";
import { getRepository } from "typeorm";

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
import { UploadController } from "./controllers/UploadController";

import * as db from "@core/database";
import { log, requestErrorLogger, requestLogger } from "@core/logging";
import sessions from "@core/sessions";
import startServer from "@core/server";

import ContactsService from "@core/services/ContactsService";

import Contact from "@models/Contact";
import ApiKey from "@models/ApiKey";
import config from "@config";

async function isValidApiKey(key: string): Promise<boolean> {
  const [_, secret] = key.split("_");
  const secretHash = crypto.createHash("sha256").update(secret).digest("hex");
  const apiKey = await getRepository(ApiKey).findOne({ secretHash });
  return !!apiKey;
}

async function checkAuthorization(
  action: Action
): Promise<true | Contact | undefined> {
  const headers = (action.request as Request).headers;
  const authHeader = headers.authorization;

  // If there's a bearer key check API key
  if (authHeader?.startsWith("Bearer ")) {
    if (await isValidApiKey(authHeader.substring(7))) {
      // API key can act as a user
      const contactId = headers["x-contact-id"]?.toString();
      return contactId ? await ContactsService.findOne(contactId) : true;
    }
  } else {
    // Otherwise use logged in user
    return (action.request as Request).user;
  }
}

async function currentUserChecker(
  action: Action
): Promise<Contact | undefined> {
  const apiKeyOrContact = await checkAuthorization(action);
  // API key isn't a user
  return apiKeyOrContact === true ? undefined : apiKeyOrContact;
}

async function authorizationChecker(
  action: Action,
  roles: RoleType[]
): Promise<boolean> {
  const apiKeyOrContact = await checkAuthorization(action);
  // API key has superadmin abilities
  return apiKeyOrContact === true
    ? true
    : roles.every((role) => apiKeyOrContact?.hasRole(role));
}

const app = express();

app.use(requestLogger);

app.use(cors({ origin: config.trustedOrigins }));

app.use(cookie());

db.connect().then(() => {
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
      UploadController
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

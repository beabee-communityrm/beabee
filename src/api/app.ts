import "module-alias/register";
import "reflect-metadata";

import { RoleType } from "@beabee/beabee-common";
import cookie from "cookie-parser";
import crypto from "crypto";
import express, { ErrorRequestHandler, Request } from "express";
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
import { SegmentController } from "./controllers/SegmentController";
import { SignupController } from "./controllers/SignupController";
import { StatsController } from "./controllers/StatsController";
import { ResetPasswordController } from "./controllers/ResetPasswordController";

import * as db from "@core/database";
import { log, requestErrorLogger, requestLogger } from "@core/logging";
import sessions from "@core/sessions";
import startServer from "@core/server";

import Contact from "@models/Contact";
import { getRepository } from "typeorm";
import ApiKey from "@models/ApiKey";
import ContactsService from "@core/services/ContactsService";

async function isValidApiKey(authHeader: string): Promise<boolean> {
  const [type, token] = authHeader.split(" ");
  if (type === "Bearer") {
    const [_, secret] = token.split("_");
    const secretHash = crypto.createHash("sha256").update(secret).digest("hex");
    const apiKey = await getRepository(ApiKey).findOne({ secretHash });
    return !!apiKey;
  }
  return false;
}

async function currentUserChecker(
  action: Action
): Promise<Contact | undefined> {
  const headers = (action.request as Request).headers;
  const authHeader = headers.authorization;

  if (authHeader) {
    const contactId = headers["x-contact-id"];
    if ((await isValidApiKey(authHeader)) && contactId) {
      return await ContactsService.findOne(contactId.toString());
    }
  } else {
    return (action.request as Request).user;
  }
}

async function authorizationChecker(
  action: Action,
  roles: RoleType[]
): Promise<boolean> {
  let contact: Contact | undefined;

  const headers = (action.request as Request).headers;
  const authHeader = headers.authorization;
  if (authHeader) {
    const contactId = headers["x-contact-id"];
    if (await isValidApiKey(authHeader)) {
      if (contactId) {
        contact = await ContactsService.findOne(contactId.toString());
      } else {
        return true;
      }
    }
  } else {
    contact = await currentUserChecker(action);
  }

  return !!contact && roles.every((role) => contact?.hasRole(role));
}

const app = express();

app.use(requestLogger);

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
      SegmentController,
      SignupController,
      StatsController,
      ResetPasswordController
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

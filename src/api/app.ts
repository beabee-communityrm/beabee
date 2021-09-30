import "module-alias/register";
import "reflect-metadata";

import cookie from "cookie-parser";
import express, { ErrorRequestHandler, Request } from "express";
import {
  Action,
  HttpError,
  InternalServerError,
  NotFoundError,
  useExpressServer
} from "routing-controllers";

import { CalloutController } from "./controllers/CalloutController";
import { MemberController } from "./controllers/MemberController";
import { NoticeController } from "./controllers/NoticeController";
import { SignupController } from "./controllers/SignupController";

import * as db from "@core/database";
import { log, requestErrorLogger, requestLogger } from "@core/logging";
import sessions from "@core/sessions";
import startServer from "@core/server";

import Member from "@models/Member";

function currentUserChecker(action: Action): Member | undefined {
  return (action.request as Request).user;
}

const app = express();

app.use(requestLogger);

app.use(cookie());

db.connect().then(() => {
  sessions(app);

  useExpressServer(app, {
    routePrefix: "/1.0",
    controllers: [
      CalloutController,
      MemberController,
      NoticeController,
      SignupController
    ],
    currentUserChecker,
    authorizationChecker: (action) => !!currentUserChecker(action),
    validation: {
      forbidNonWhitelisted: true,
      forbidUnknownValues: true,
      whitelist: true,
      validationError: {
        target: false,
        value: false
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

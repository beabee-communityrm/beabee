import "module-alias/register";
import "reflect-metadata";

import cookie from "cookie-parser";
import express, { ErrorRequestHandler, Request } from "express";
import { Action, HttpError, useExpressServer } from "routing-controllers";

import { CalloutController } from "./controllers/CalloutController";
import { MemberController } from "./controllers/MemberController";
import { NoticeController } from "./controllers/NoticeController";
import { SignupController } from "./controllers/SignupController";

import * as db from "@core/database";
import { requestErrorLogger, requestLogger } from "@core/logging";
import sessions from "@core/sessions";
import startServer from "@core/server";

import Member from "@models/Member";

async function currentUserChecker(action: Action): Promise<Member | undefined> {
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
    authorizationChecker: (action) => !!currentUserChecker(action)
  });

  // TODO: Why do we need this?
  app.use(function (error, req, res, next) {
    if (!(error instanceof HttpError)) {
      next(error);
    }
  } as ErrorRequestHandler);

  app.use(requestErrorLogger);

  startServer(app);
});

import "module-alias/register";
import "reflect-metadata";

import cookie from "cookie-parser";
import express, { ErrorRequestHandler, Request } from "express";
import { Action, HttpError, useExpressServer } from "routing-controllers";

import { MemberController } from "./controllers/MemberController";
import { SignupController } from "./controllers/SignupController";

import * as db from "@core/database";
import sessions from "@core/sessions";
import { log, requestErrorLogger, requestLogger } from "@core/logging";

import Member from "@models/Member";

async function currentUserChecker(action: Action): Promise<Member | undefined> {
  return (action.request as Request).user;
}

const app = express();

app.use(cookie());

db.connect().then(() => {
  sessions(app);

  app.use(requestLogger);

  useExpressServer(app, {
    routePrefix: "/1.0",
    controllers: [MemberController, SignupController],
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

  log.info("Starting server...");

  const server = app.listen(3000);

  process.on("SIGTERM", () => {
    log.debug("Waiting for server to shutdown");
    db.close();

    setTimeout(() => {
      log.warn("Server was forced to shutdown after timeout");
      process.exit(1);
    }, 20000).unref();

    server.close(() => process.exit());
  });
});

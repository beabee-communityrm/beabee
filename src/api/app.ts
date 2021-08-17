import "module-alias/register";
import "reflect-metadata";

import cookie from "cookie-parser";
import express, { ErrorRequestHandler, Request } from "express";
import { Action, HttpError, useExpressServer } from "routing-controllers";

import { MemberController } from "./controllers/MemberController";
import { SignupController } from "./controllers/SignupController";

import * as db from "@core/database";
import { log } from "@core/logging";
import sessions from "@core/sessions";

import Member from "@models/Member";

async function currentUserChecker(action: Action): Promise<Member | undefined> {
  return (action.request as Request).user;
}

const app = express();

app.use(cookie());

db.connect().then(() => {
  sessions(app);

  app.use((req, res, next) => {
    console.log("REQUEST START:", req.method, req.url);
    next();
  });

  useExpressServer(app, {
    routePrefix: "/1.0",
    controllers: [MemberController, SignupController],
    currentUserChecker,
    authorizationChecker: (action) => !!currentUserChecker(action)
  });

  app.use((req, res, next) => {
    console.log("REQUEST END:", req.method, req.url, res.statusCode);
    next();
  });

  app.use(function (error, req, res, next) {
    console.log("REQUEST END:", req.method, req.url, res.statusCode);
    if (!(error instanceof HttpError)) {
      next(error);
    }
  } as ErrorRequestHandler);

  const server = app.listen(3000);

  process.on("SIGTERM", () => {
    log.debug({
      app: "main",
      action: "stop-webserver",
      message: "Waiting for server to shutdown"
    });

    db.close();

    setTimeout(() => {
      log.debug({
        app: "main",
        action: "stop-webserver",
        message: "Server was forced to shutdown after timeout"
      });
      process.exit(1);
    }, 20000).unref();

    server.close(() => process.exit());
    //internalServer.close();
  });
});

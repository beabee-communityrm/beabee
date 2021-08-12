import "module-alias/register";
import "reflect-metadata";

import cookie from "cookie-parser";
import express, { ErrorRequestHandler, Request } from "express";
import expressWinston from "express-winston";
import { Action, HttpError, useExpressServer } from "routing-controllers";
import winston from "winston";

import { MemberController } from "./controllers/MemberController";
import { SignupController } from "./controllers/SignupController";

import * as db from "@core/database";
import sessions from "@core/sessions";

import Member from "@models/Member";

async function currentUserChecker(action: Action): Promise<Member | undefined> {
  return (action.request as Request).user;
}

const app = express();

const logger = winston.createLogger({
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.simple()
  ),
  levels: winston.config.syslog.levels,
  transports: [new winston.transports.Console()]
});

app.use(cookie());

db.connect().then(() => {
  sessions(app);

  app.use(expressWinston.logger({ winstonInstance: logger }));

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

  app.use(expressWinston.errorLogger({ winstonInstance: logger }));

  logger.info("Starting server...");

  const server = app.listen(3000);

  process.on("SIGTERM", () => {
    logger.debug("Waiting for server to shutdown");
    db.close();

    setTimeout(() => {
      logger.warn("Server was forced to shutdown after timeout");
      process.exit(1);
    }, 20000).unref();

    server.close(() => process.exit());
    //internalServer.close();
  });
});

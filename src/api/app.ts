import "module-alias/register";
import "reflect-metadata";

import { RoleType } from "@beabee/beabee-common";
import cookie from "cookie-parser";
import cors from "cors";
import express, { ErrorRequestHandler, Request } from "express";
import {
  HttpError,
  InternalServerError,
  NotFoundError,
  useExpressServer
} from "routing-controllers";

import controllers from "@api/controllers";

import { ValidateResponseInterceptor } from "./interceptors/ValidateResponseInterceptor";

import { AuthMiddleware } from "./middlewares/AuthMiddleware";

import {
  log as mainLogger,
  requestErrorLogger,
  requestLogger
} from "@core/logging";
import sessions from "@core/sessions";
import { initApp, startServer } from "@core/server";

import Contact from "@models/Contact";

import config from "@config";

function currentUserChecker(action: { request: Request }): Contact | undefined {
  return action.request.auth?.entity instanceof Contact
    ? action.request.auth.entity
    : undefined;
}

function authorizationChecker(
  action: { request: Request },
  roles: RoleType[]
): boolean {
  return roles.every((r) => action.request.auth?.roles.includes(r));
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
      controllers,
      interceptors: [ValidateResponseInterceptor],
      middlewares: [AuthMiddleware],
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

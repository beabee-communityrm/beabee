import { ErrorObject, ValidateFunction } from "ajv";
import { NextFunction, Request, RequestHandler, Response } from "express";
import { EntityTarget, FindOneOptions, ObjectLiteral } from "typeorm";

import { getRepository } from "#core/database";
import ajv from "#core/lib/ajv";
import { wrapAsync, isInvalidType } from "#core/utils";
import * as auth from "#core/utils/auth";

import OptionsService from "#core/services/OptionsService";

import config from "#config";

interface OnErrorHandler {
  (
    errors: ErrorObject[],
    req: Request,
    res: Response,
    next?: NextFunction
  ): void;
}

const validationKeys = ["body", "query", "params"] as const;
type ValidationKeys = typeof validationKeys extends readonly (infer U)[]
  ? U
  : never;

type Validators = Partial<Record<ValidationKeys, ValidateFunction>>;

interface HasSchema {
  or400: RequestHandler;
  orFlash: RequestHandler;
  orRedirect(url: string): RequestHandler;
  orReplyWithJSON: RequestHandler;
}

function convertErrorsToMessages(errors: ErrorObject[]): string[] {
  const genericErrorMessage =
    OptionsService.getText("flash-validation-error-generic") || "";
  return (
    errors
      .map((error) => {
        switch (error.keyword) {
          case "required":
            return `flash-validation-error${error.instancePath}.${error.params.missingProperty}-required`;
          case "format":
            return `flash-validation-error.${error.params.format}-format`;
          default:
            return `flash-validation-error${error.instancePath}-${error.keyword}`;
        }
      })
      .map((key) => {
        return OptionsService.isKey(key)
          ? OptionsService.getText(key)
          : config.dev
            ? key
            : genericErrorMessage;
      })
      // Don't show duplicate errors twice
      .filter((value, index, arr) => arr.indexOf(value) === index)
  );
}

const flashErrors: OnErrorHandler = (errors, req, res) => {
  convertErrorsToMessages(errors).forEach((message) =>
    req.flash("danger", message)
  );

  res.redirect(req.originalUrl);
};

const send400: OnErrorHandler = (errors, req, res) => {
  res.status(400).send(errors);
};

const redirectTo =
  (url: string): OnErrorHandler =>
  (errors, req, res) =>
    res.redirect(url);

const replyWithJSON: OnErrorHandler = (errors, req, res) => {
  res.status(400).send(convertErrorsToMessages(errors));
};

function onRequest(
  validators: Validators,
  onErrors: OnErrorHandler
): RequestHandler {
  return (req, res, next) => {
    const errors = validationKeys
      .map((key) => {
        const validator = validators[key];
        return !validator || validator(req[key]) ? [] : validator.errors!;
      })
      .reduce((a, b) => [...a, ...b]);

    if (errors.length > 0) {
      onErrors(errors, req, res, next);
    } else {
      next();
    }
  };
}

// eslint-disable-next-line @typescript-eslint/ban-types
export function hasSchema(
  schema: Partial<Record<ValidationKeys, object>>
): HasSchema {
  const validators: Validators = {};

  for (const key of validationKeys) {
    const keySchema = schema[key];
    if (keySchema) {
      validators[key] = ajv.compile(keySchema);
    }
  }

  return {
    or400: onRequest(validators, send400),
    orFlash: onRequest(validators, flashErrors),
    orRedirect(url) {
      return onRequest(validators, redirectTo(url));
    },
    orReplyWithJSON: onRequest(validators, replyWithJSON)
  };
}

export function hasNewModel<T extends ObjectLiteral>(
  entity: EntityTarget<T>,
  prop: keyof T,
  findOpts: FindOneOptions<T> = {}
): RequestHandler {
  return wrapAsync(async (req, res, next) => {
    if (!req.model || (req.model as any)[prop] !== req.params[prop as string]) {
      try {
        req.model = await getRepository(entity).findOne({
          where: {
            [prop]: req.params[prop as string]
          } as T,
          ...findOpts
        });
      } catch (err) {
        if (!isInvalidType(err)) {
          throw err;
        }
      }
    }
    if (req.model) {
      next();
    } else {
      next("route");
    }
  });
}

/**
 * @deprecated The old login is no longer used
 * @param req
 * @param res
 * @param next
 * @returns
 */
export function isLoggedIn(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const status = auth.loggedIn(req);

  switch (status) {
    case auth.AuthenticationStatus.LOGGED_IN:
      return next();
    default:
      auth.handleNotAuthed(status, req, res);
      return;
  }
}

/**
 * Express middleware to redirect users without admin/superadmin privileges
 */
export function isAdmin(req: Request, res: Response, next: NextFunction): void {
  const status = auth.canAdmin(req);
  switch (status) {
    case auth.AuthenticationStatus.LOGGED_IN:
      return next();
    case auth.AuthenticationStatus.NOT_ADMIN:
      req.flash("warning", "403");
      res.redirect("/");
      return;
    default:
      auth.handleNotAuthed(status, req, res);
      return;
  }
}

/**
 * Express middleware to redirect users without superadmin privilages
 * @param req
 * @param res
 * @param next
 * @returns
 */
export function isSuperAdmin(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const status = auth.canSuperAdmin(req);
  switch (status) {
    case auth.AuthenticationStatus.LOGGED_IN:
      return next();
    case auth.AuthenticationStatus.NOT_ADMIN:
      req.flash("warning", "403");
      res.redirect("/");
      return;
    default:
      auth.handleNotAuthed(status, req, res);
      return;
  }
}

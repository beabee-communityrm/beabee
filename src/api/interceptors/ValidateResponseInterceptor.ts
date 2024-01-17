import { validate } from "class-validator";
import { Request } from "express";
import {
  Action,
  Interceptor,
  InterceptorInterface,
  InternalServerError
} from "routing-controllers";

import { log as mainLogger } from "@core/logging";

const log = mainLogger.child({ app: "validate-response-interceptor" });

@Interceptor()
export class ValidateResponseInterceptor implements InterceptorInterface {
  async intercept(action: Action, content: any) {
    if (content === undefined || content === null) {
      return content;
    }

    const request = action.request as Request;
    const groups = request.user?.hasRole("admin") ? ["admin"] : [];

    const errors = await validate(content, {
      groups,
      always: true,
      strictGroups: true,
      whitelist: true,
      forbidUnknownValues: true,
      forbidNonWhitelisted: true,
      stopAtFirstError: true
    });
    if (errors.length > 0) {
      log.error("Validation failed on response", { errors });
      throw new InternalServerError("Validation failed");
    }

    return content;
  }
}

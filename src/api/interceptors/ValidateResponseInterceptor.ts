import { ServerResponse } from "node:http";

import { Request } from "express";
import {
  Action,
  Interceptor,
  InterceptorInterface,
  InternalServerError
} from "routing-controllers";

import { log as mainLogger } from "@core/logging";
import { validateOrReject } from "@api/utils";

const log = mainLogger.child({ app: "validate-response-interceptor" });

@Interceptor()
export class ValidateResponseInterceptor implements InterceptorInterface {
  async intercept(action: Action, content: any) {
    if (
      content === undefined ||
      content === null ||
      content instanceof ServerResponse
    ) {
      return content;
    }

    const request = action.request as Request;
    const groups = request.user?.hasRole("admin") ? ["admin"] : [];
    const items = Array.isArray(content) ? content : [content];

    try {
      for (const item of items) {
        await validateOrReject(item, {
          groups,
          always: true,
          strictGroups: true,
          whitelist: true,
          forbidUnknownValues: true,
          forbidNonWhitelisted: true,
          validationError: { target: false }
        });
      }
    } catch (errors) {
      log.error("Validation failed on response", { errors });
      // TODO: Just log error for now
      // throw new InternalServerError("Validation failed");
    }

    return content;
  }
}

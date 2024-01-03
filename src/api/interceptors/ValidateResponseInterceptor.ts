import { validate } from "class-validator";
import { Request } from "express";
import {
  Action,
  Interceptor,
  InterceptorInterface,
  InternalServerError
} from "routing-controllers";

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
      console.log(JSON.stringify(errors, null, 2));
      throw new InternalServerError("Validation failed");
    }

    return content;
  }
}

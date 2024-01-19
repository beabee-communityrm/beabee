import { Request } from "express";
import { createParamDecorator } from "routing-controllers";

import { AuthInfo } from "@type/auth-info";

export function CurrentAuth(options?: { required?: boolean }) {
  return createParamDecorator({
    required: options && options.required ? true : false,
    value: (action: { request: Request }): AuthInfo | undefined => {
      return action.request.auth;
    }
  });
}

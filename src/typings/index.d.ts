import { ParamsDictionary } from "express-serve-static-core";

import ApiKey from "@models/ApiKey";
import { CalloutResponseAnswersSlide } from "@models/CalloutResponse";
import Contact from "@models/Contact";

import { AuthInfo as AuthInfo2 } from "@type/auth-info";

declare global {
  type HTMLElement = never;
  type BufferSource = never;
  type FormData = never;
  type URLSearchParams = never;

  namespace Express {
    export interface User extends Contact {}

    export interface Request {
      flash(
        level: "info" | "success" | "warning" | "error" | "danger",
        message: string
      ): void;
      model: unknown;
      allParams: ParamsDictionary;
      answers?: CalloutResponseAnswersSlide;
      auth: AuthInfo2 | undefined;
    }
  }
}

declare module "papaparse" {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface File {}
}

declare module "express-session" {
  interface SessionData {
    method?: "plain" | "totp";
    answers: CalloutResponseAnswersSlide | undefined;
  }
}

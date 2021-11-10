import { ParamsDictionary } from "express-serve-static-core";

import Member from "@models/Member";
import { PollResponseAnswers } from "@models/PollResponse";

declare global {
  type WithRelationIds<E, K extends keyof E> = Omit<E, K> & {
    [key in K]: string;
  };

  namespace Express {
    export interface User extends Member {}

    export interface Request {
      flash(
        level: "info" | "success" | "warning" | "error" | "danger",
        message: string
      ): void;
      model: unknown;
      allParams: ParamsDictionary;
      answers?: PollResponseAnswers;
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
    answers?: PollResponseAnswers;
  }
}

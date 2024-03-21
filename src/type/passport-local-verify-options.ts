import type { IVerifyOptions } from "passport-local";
import type { LOGIN_CODES } from "#enums/login-codes";

export type PassportLocalVerifyOptions = IVerifyOptions & {
  message: LOGIN_CODES | string;
};

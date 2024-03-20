import type Contact from "#models/Contact";
import type { HttpError } from "routing-controllers";
import type { UnauthorizedError } from "#api/errors/UnauthorizedError";
import type { PassportLocalVerifyOptions } from "#type/passport-local-verify-options";

export type PassportLocalDoneCallback = (
  error: null | HttpError | UnauthorizedError,
  user: Contact | false,
  options?: PassportLocalVerifyOptions | undefined
) => void;

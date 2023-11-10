import { UnauthorizedError as _UnauthorizedError } from "routing-controllers";

/**
 * UnauthorizedError with optional code
 */
export class UnauthorizedError extends _UnauthorizedError {
  code?: string | undefined;

  constructor({ message, code }: { message?: string; code?: string } = {}) {
    super(message);
    Object.setPrototypeOf(this, UnauthorizedError.prototype);
    this.code = code;
  }
}

export default UnauthorizedError;

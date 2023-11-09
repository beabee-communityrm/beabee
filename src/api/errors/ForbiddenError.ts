import { ForbiddenError as _ForbiddenError } from "routing-controllers";

/**
 * ForbiddenError with optional code
 */
export class ForbiddenError extends _ForbiddenError {
  code?: string | undefined;

  constructor({ message, code }: { message?: string; code?: string } = {}) {
    super(message);
    Object.setPrototypeOf(this, ForbiddenError.prototype);
    this.code = code;
  }
}

export default ForbiddenError;

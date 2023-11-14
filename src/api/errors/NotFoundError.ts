import { NotFoundError as _NotFoundError } from "routing-controllers";

/**
 * NotFoundError with optional code
 */
export class NotFoundError extends _NotFoundError {
  code?: string | undefined;

  constructor({ message, code }: { message?: string; code?: string } = {}) {
    super(message);
    Object.setPrototypeOf(this, NotFoundError.prototype);
    this.code = code;
  }
}

export default NotFoundError;

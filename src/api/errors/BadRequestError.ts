import { BadRequestError as _BadRequestError } from "routing-controllers";

/**
 * BadRequestError with optional code
 */
export class BadRequestError extends _BadRequestError {
    code?: string | undefined;

    constructor({ message, code }: { message?: string; code?: string } = {}) {
        super(message);
        Object.setPrototypeOf(this, BadRequestError.prototype);
        this.code = code;
    }
}

export default BadRequestError;

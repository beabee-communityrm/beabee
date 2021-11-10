import { BadRequestError } from "routing-controllers";

export default class DuplicateEmailError extends BadRequestError {
  readonly code = "duplicate-email";

  constructor() {
    super();
    Object.setPrototypeOf(this, DuplicateEmailError.prototype);
  }
}

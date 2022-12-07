import { BadRequestError } from "routing-controllers";

export default class DuplicateId extends BadRequestError {
  readonly code = "duplicate-id";

  constructor(readonly id: string) {
    super();
    Object.setPrototypeOf(this, DuplicateId.prototype);
  }
}

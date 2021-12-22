import { BadRequestError } from "routing-controllers";

export default class CantUpdateContribution extends BadRequestError {
  readonly code = "cant-update-contribution";

  constructor() {
    super();
    Object.setPrototypeOf(this, CantUpdateContribution.prototype);
  }
}

import { BadRequestError } from "routing-controllers";

export default class InvalidCalloutResponse extends BadRequestError {
  readonly code = "invalid-callout-response";
  constructor(readonly subCode: string) {
    super();
    Object.setPrototypeOf(this, InvalidCalloutResponse.prototype);
  }
}

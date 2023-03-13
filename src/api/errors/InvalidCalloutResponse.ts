import { BadRequestError } from "routing-controllers";

type InvalidCalloutResponseCode =
  | "only-anonymous"
  | "expired-user"
  | "closed"
  | "cant-update"
  | "guest-fields-missing"
  | "logged-in-guest-fields"
  | "unknown-user";

export default class InvalidCalloutResponse extends BadRequestError {
  readonly code = "invalid-callout-response";
  constructor(readonly subCode: InvalidCalloutResponseCode) {
    super();
    Object.setPrototypeOf(this, InvalidCalloutResponse.prototype);
  }
}

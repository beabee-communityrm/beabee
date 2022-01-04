import { BadRequestError } from "routing-controllers";

export default class NoPaymentSource extends BadRequestError {
  readonly code = "no-payment-source";

  constructor() {
    super();
    Object.setPrototypeOf(this, NoPaymentSource.prototype);
  }
}

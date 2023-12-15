import { Paginated } from "@api/data/PaginatedData";
import {
  Authorized,
  CurrentUser,
  Get,
  JsonController,
  QueryParams
} from "routing-controllers";

import Contact from "@models/Contact";

import paymentTransformer from "@api/transformers/payment/payment.transformer";
import {
  GetPaymentData,
  GetPaymentsQuery
} from "@api/transformers/payment/payment.data";

@JsonController("/payment")
@Authorized()
export class PaymentController {
  @Get("/")
  async getPayments(
    @CurrentUser() contact: Contact,
    @QueryParams() query: GetPaymentsQuery
  ): Promise<Paginated<GetPaymentData>> {
    return await paymentTransformer.fetch(query, contact);
  }
}

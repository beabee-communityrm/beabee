import { Paginated } from "@api/data/PaginatedData";
import {
  Authorized,
  CurrentUser,
  Get,
  JsonController,
  Param,
  QueryParams
} from "routing-controllers";

import { GetPaymentDto, QueryPaymentsDto } from "@api/dto/PaymentDto";
import PaymentTransformer from "@api/transformers/PaymentTransformer";

import Contact from "@models/Contact";

@JsonController("/payment")
@Authorized()
export class PaymentController {
  @Get("/")
  async getPayments(
    @CurrentUser() contact: Contact,
    @QueryParams() query: QueryPaymentsDto
  ): Promise<Paginated<GetPaymentDto>> {
    return await PaymentTransformer.fetch(query, contact);
  }

  @Get("/:id")
  async getPayment(
    @CurrentUser() contact: Contact,
    @Param("id") id: string
  ): Promise<GetPaymentDto | undefined> {
    return await PaymentTransformer.fetchOneById(id, contact);
  }
}

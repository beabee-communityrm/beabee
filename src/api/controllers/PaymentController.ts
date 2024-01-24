import {
  Authorized,
  Get,
  JsonController,
  Param,
  QueryParams
} from "routing-controllers";

import { CurrentAuth } from "@api/decorators/CurrentAuth";
import { PaginatedDto } from "@api/dto/PaginatedDto";
import {
  GetPaymentDto,
  GetPaymentOptsDto,
  ListPaymentsDto
} from "@api/dto/PaymentDto";
import PaymentTransformer from "@api/transformers/PaymentTransformer";

import { AuthInfo } from "@type/auth-info";

@JsonController("/payment")
@Authorized()
export class PaymentController {
  @Get("/")
  async getPayments(
    @CurrentAuth({ required: true }) auth: AuthInfo,
    @QueryParams() query: ListPaymentsDto
  ): Promise<PaginatedDto<GetPaymentDto>> {
    return await PaymentTransformer.fetch(auth, query);
  }

  @Get("/:id")
  async getPayment(
    @CurrentAuth({ required: true }) auth: AuthInfo,
    @Param("id") id: string,
    @QueryParams() query: GetPaymentOptsDto
  ): Promise<GetPaymentDto | undefined> {
    return await PaymentTransformer.fetchOneById(auth, id, query);
  }
}

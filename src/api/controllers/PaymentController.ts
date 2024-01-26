import {
  Authorized,
  Get,
  JsonController,
  Param,
  QueryParams
} from "routing-controllers";
import { ResponseSchema } from "routing-controllers-openapi";

import { CurrentAuth } from "@api/decorators/CurrentAuth";
import {
  GetPaymentDto,
  GetPaymentListDto,
  GetPaymentOptsDto,
  ListPaymentsDto
} from "@api/dto/PaymentDto";
import PaymentTransformer from "@api/transformers/PaymentTransformer";

import { AuthInfo } from "@type/auth-info";

@JsonController("/payment")
@Authorized()
export class PaymentController {
  @Get("/")
  @ResponseSchema(GetPaymentListDto)
  async getPayments(
    @CurrentAuth({ required: true }) auth: AuthInfo,
    @QueryParams() query: ListPaymentsDto
  ): Promise<GetPaymentListDto> {
    return await PaymentTransformer.fetch(auth, query);
  }

  @Get("/:id")
  @ResponseSchema(GetPaymentDto, { statusCode: 200 })
  async getPayment(
    @CurrentAuth({ required: true }) auth: AuthInfo,
    @Param("id") id: string,
    @QueryParams() query: GetPaymentOptsDto
  ): Promise<GetPaymentDto | undefined> {
    return await PaymentTransformer.fetchOneById(auth, id, query);
  }
}

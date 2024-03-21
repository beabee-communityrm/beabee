import { IsOptional, IsString } from "class-validator";

import { PaymentFlowParams } from "#core/providers/payment-flow";

export class GetPaymentFlowDto implements PaymentFlowParams {
  @IsOptional()
  @IsString()
  clientSecret?: string;

  @IsOptional()
  @IsString()
  redirectUrl?: string;
}

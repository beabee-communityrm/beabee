import { IsOptional, IsString } from "class-validator";

import { PaymentFlowParams } from "@type/index";

export class GetPaymentFlowDto implements PaymentFlowParams {
  @IsOptional()
  @IsString()
  clientSecret?: string;

  @IsOptional()
  @IsString()
  redirectUrl?: string;
}

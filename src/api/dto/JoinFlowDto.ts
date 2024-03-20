import { PaymentMethod } from "@beabee/beabee-common";
import IsUrl from "#api/validators/IsUrl";
import { IsEnum, IsOptional, IsString } from "class-validator";

export class StartJoinFlowDto {
  @IsUrl()
  completeUrl!: string;

  @IsEnum(PaymentMethod)
  @IsOptional()
  paymentMethod?: PaymentMethod;
}

export class CompleteJoinFlowDto {
  @IsString()
  paymentFlowId!: string;
}

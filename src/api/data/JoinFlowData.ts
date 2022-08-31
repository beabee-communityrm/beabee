import IsUrl from "@api/validators/IsUrl";
import { PaymentMethod } from "@core/utils";
import { IsEnum, IsOptional, IsString } from "class-validator";

export class StartJoinFlowData {
  @IsUrl()
  completeUrl!: string;

  @IsEnum(PaymentMethod)
  @IsOptional()
  paymentMethod?: PaymentMethod;
}

export class CompleteJoinFlowData {
  @IsString()
  paymentFlowId!: string;
}

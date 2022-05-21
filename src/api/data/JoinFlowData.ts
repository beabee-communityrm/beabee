import IsUrl from "@api/validators/IsUrl";
import { PaymentMethod } from "@core/utils";
import { IsEnum, IsString } from "class-validator";

export class StartJoinFlowData {
  @IsUrl()
  completeUrl!: string;

  @IsEnum(PaymentMethod)
  paymentMethod!: PaymentMethod;
}

export class CompleteJoinFlowData {
  @IsString()
  paymentFlowId!: string;
}

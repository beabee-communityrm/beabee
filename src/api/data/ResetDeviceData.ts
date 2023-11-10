import { IsEmail, Validate, IsIn } from "class-validator";
import IsPassword from "@api/validators/IsPassword";
import IsUrl from "@api/validators/IsUrl";
import { RESET_SECURITY_FLOW_TYPE } from "@enums/reset-security-flow-type";

export class CreateResetDeviceData {
  @IsEmail()
  email!: string;

  @IsUrl()
  resetUrl!: string;

  @IsIn([RESET_SECURITY_FLOW_TYPE.TOTP])
  type!: RESET_SECURITY_FLOW_TYPE.TOTP;
}

export class UpdateResetDeviceData {
  @Validate(IsPassword)
  password!: string;
}

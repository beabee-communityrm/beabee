import { IsEmail, Validate, IsIn } from "class-validator";
import IsPassword from "@api/validators/IsPassword";
import IsUrl from "@api/validators/IsUrl";
import { RESET_SECURITY_FLOW_TYPE } from "@enums/reset-security-flow-type";

export class CreateResetPasswordData {
  @IsEmail()
  email!: string;

  @IsUrl()
  resetUrl!: string;

  @IsIn([RESET_SECURITY_FLOW_TYPE.PASSWORD])
  type!: RESET_SECURITY_FLOW_TYPE.PASSWORD;
}

export class UpdateResetPasswordData {
  @Validate(IsPassword)
  password!: string;
}

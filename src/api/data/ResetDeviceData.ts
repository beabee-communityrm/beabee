import { IsEmail, Validate } from "class-validator";
import IsPassword from "@api/validators/IsPassword";
import IsUrl from "@api/validators/IsUrl";

export class CreateResetDeviceData {
  @IsEmail()
  email!: string;

  @IsUrl()
  resetUrl!: string;
}

export class UpdateResetDeviceData {
  @Validate(IsPassword)
  password!: string;
}

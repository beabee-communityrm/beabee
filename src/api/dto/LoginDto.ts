import { IsEmail, IsOptional, IsString } from "class-validator";

export class LoginDto {
  @IsEmail()
  email!: string;

  // We deliberately don't validate with IsPassword here so
  // invalid passwords return a 401
  @IsString()
  password!: string;

  /** Optional multi factor authentication token */
  @IsString()
  @IsOptional()
  token?: string;
}

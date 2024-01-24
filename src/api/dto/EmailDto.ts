import { IsString } from "class-validator";

export class UpdateEmailDto {
  @IsString()
  subject!: string;

  @IsString()
  body!: string;
}

export class GetEmailDto extends UpdateEmailDto {}

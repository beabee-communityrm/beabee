import { IsString } from "class-validator";

export interface GetEmailDto {
  subject: string;
  body: string;
}

export class UpdateEmailDto implements GetEmailDto {
  @IsString()
  subject!: string;

  @IsString()
  body!: string;
}

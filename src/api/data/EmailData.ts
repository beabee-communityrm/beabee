import { IsString } from "class-validator";

export interface GetEmailData {
  subject: string;
  body: string;
}

export class UpdateEmailData implements GetEmailData {
  @IsString()
  subject!: string;

  @IsString()
  body!: string;
}

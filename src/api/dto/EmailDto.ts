import { IsString } from "class-validator";

export class EmailDto {
  @IsString()
  subject!: string;

  @IsString()
  body!: string;
}

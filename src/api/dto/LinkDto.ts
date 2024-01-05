import { IsString } from "class-validator";

export class LinkDto {
  @IsString()
  url!: string;

  @IsString()
  text!: string;
}

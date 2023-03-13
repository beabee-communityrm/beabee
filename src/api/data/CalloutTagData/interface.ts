import { IsString } from "class-validator";

export interface GetCalloutTagData {
  id: string;
  name: string;
}

export class CreateCalloutTagData {
  @IsString()
  name!: string;

  @IsString()
  description!: string;
}

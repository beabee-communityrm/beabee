import { IsString } from "class-validator";

export interface GetContactTagData {
  id: string;
  name: string;
}

export class CreateContactTagData {
  @IsString()
  name!: string;

  @IsString()
  description!: string;
}

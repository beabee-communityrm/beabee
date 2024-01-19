import { IsString, IsUUID } from "class-validator";

export class CalloutResponseParams {
  @IsUUID("4")
  id!: string;

  @IsString()
  slug!: string;
}

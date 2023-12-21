import { IsString, IsUUID } from "class-validator";
import { UUIDParams } from "@api/params/UUIDParams";

export class CalloutResponseParams {
  @IsUUID("4")
  id!: string;

  @IsString()
  slug!: string;
}

import { IsUUID } from "class-validator";

export class UUIDParams {
  @IsUUID("4")
  id!: string;
}

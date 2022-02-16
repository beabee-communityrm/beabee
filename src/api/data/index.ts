import { IsUUID } from "class-validator";

export class UUIDParam {
  @IsUUID("4")
  id!: string;
}

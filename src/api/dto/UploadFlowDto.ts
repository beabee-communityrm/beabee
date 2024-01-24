import { IsString } from "class-validator";

export class GetUploadFlowDto {
  @IsString()
  id!: string;
}

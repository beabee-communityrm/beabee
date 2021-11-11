import IsUrl from "@api/validators/IsUrl";
import { IsString } from "class-validator";

export class StartJoinFlowData {
  @IsUrl()
  completeUrl!: string;
}

export class CompleteJoinFlowData {
  @IsString()
  redirectFlowId!: string;
}

import { RoleType, RoleTypes } from "@beabee/beabee-common";
import { Type } from "class-transformer";
import { IsDate, IsOptional, IsIn } from "class-validator";

export class UpdateUserRoleData {
  @Type(() => Date)
  @IsDate()
  dateAdded!: Date;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  dateExpires!: Date | null;
}

export interface GetUserRoleData extends UpdateUserRoleData {
  role: RoleType;
}

export class CreateUserRoleData
  extends UpdateUserRoleData
  implements GetUserRoleData
{
  @IsIn(RoleTypes)
  role!: RoleType;
}

import { RoleType, RoleTypes } from "@beabee/beabee-common";
import { Type } from "class-transformer";
import { IsDate, IsIn, IsOptional } from "class-validator";

export class UpdateContactRoleDto {
  @Type(() => Date)
  @IsDate()
  dateAdded!: Date;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  dateExpires!: Date | null;
}

export interface GetContactRoleDto extends UpdateContactRoleDto {
  role: RoleType;
}

export class CreateContactRoleDto
  extends UpdateContactRoleDto
  implements GetContactRoleDto
{
  @IsIn(RoleTypes)
  role!: RoleType;
}

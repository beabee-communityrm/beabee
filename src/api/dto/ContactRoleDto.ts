import { UUIDParam } from "@api/data";
import { RoleType, RoleTypes } from "@beabee/beabee-common";
import { Type } from "class-transformer";
import { IsDate, IsIn, IsOptional } from "class-validator";

export class ContactRoleParams extends UUIDParam {
  @IsIn(RoleTypes)
  roleType!: RoleType;
}

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

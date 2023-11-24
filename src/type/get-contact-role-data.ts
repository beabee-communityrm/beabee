import type { RoleType } from "@beabee/beabee-common";
import type { UpdateContactRoleData } from "@api/data/ContactData/interface";

export interface GetContactRoleData extends UpdateContactRoleData {
  role: RoleType;
}

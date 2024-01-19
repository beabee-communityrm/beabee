import { RoleType } from "@beabee/beabee-common";
import type ApiKey from "@models/ApiKey";
import Contact from "@models/Contact";

export interface AuthInfo {
  entity: Contact | ApiKey;
  roles: RoleType[];
}

import { RoleType } from "@beabee/beabee-common";
import type ApiKey from "#models/ApiKey";
import Contact from "#models/Contact";

export interface AuthInfo {
  method: "user" | "api-key";
  entity: Contact | ApiKey;
  roles: RoleType[];
}

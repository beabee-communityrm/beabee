import { BaseTransformer } from "./BaseTransformer";
import { GetContactRoleDto } from "@api/dto/ContactRoleDto";

import ContactRole from "@models/ContactRole";

class ContactRoleTransformer extends BaseTransformer<
  ContactRole,
  GetContactRoleDto
> {
  protected model = ContactRole;
  protected filters = {};

  convert(role: ContactRole): GetContactRoleDto {
    return {
      role: role.type,
      dateAdded: role.dateAdded,
      dateExpires: role.dateExpires
    };
  }
}

export default new ContactRoleTransformer();

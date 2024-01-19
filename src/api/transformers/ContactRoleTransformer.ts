import { BaseTransformer } from "./BaseTransformer";
import { TransformPlainToInstance } from "class-transformer";

import { ContactRoleDto } from "@api/dto/ContactRoleDto";

import ContactRole from "@models/ContactRole";

class ContactRoleTransformer extends BaseTransformer<
  ContactRole,
  ContactRoleDto
> {
  protected model = ContactRole;
  protected filters = {};

  @TransformPlainToInstance(ContactRoleDto)
  convert(role: ContactRole): ContactRoleDto {
    return {
      role: role.type,
      dateAdded: role.dateAdded,
      dateExpires: role.dateExpires
    };
  }
}

export default new ContactRoleTransformer();

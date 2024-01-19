import { TransformPlainToInstance } from "class-transformer";

import { GetContactProfileDto } from "@api/dto/ContactProfileDto";
import AddressTransformer from "@api/transformers/AddressTransformer";
import { BaseTransformer } from "@api/transformers/BaseTransformer";

import ContactProfile from "@models/ContactProfile";

import { AuthInfo } from "@type/auth-info";

class ContactProfileTransformer extends BaseTransformer<
  ContactProfile,
  GetContactProfileDto
> {
  protected model = ContactProfile;
  protected filters = {};

  @TransformPlainToInstance(GetContactProfileDto)
  convert(
    profile: ContactProfile,
    opts: unknown,
    auth: AuthInfo | undefined
  ): GetContactProfileDto {
    return {
      telephone: profile.telephone,
      twitter: profile.twitter,
      preferredContact: profile.preferredContact,
      deliveryOptIn: profile.deliveryOptIn,
      deliveryAddress:
        profile.deliveryAddress &&
        AddressTransformer.convert(profile.deliveryAddress),
      newsletterStatus: profile.newsletterStatus,
      newsletterGroups: profile.newsletterGroups,
      ...(auth?.roles.includes("admin") && {
        tags: profile.tags,
        notes: profile.notes,
        description: profile.description
      })
    };
  }
}

export default new ContactProfileTransformer();

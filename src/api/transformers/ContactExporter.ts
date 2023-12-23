import {
  ContactFilterName,
  RoleType,
  contactFilters
} from "@beabee/beabee-common";
import { SelectQueryBuilder } from "typeorm";

import { getMembershipStatus } from "@core/services/PaymentService";

import { GetExportQuery } from "@api/dto/BaseDto";
import { ExportContactDto } from "@api/dto/ContactDto";
import { BaseTransformer } from "@api/transformers/BaseTransformer";
import ContactTransformer from "@api/transformers/ContactTransformer";

import Contact from "@models/Contact";
import { stringify } from "csv-stringify/sync";

class ContactExporter extends BaseTransformer<
  Contact,
  ExportContactDto,
  ContactFilterName,
  GetExportQuery
> {
  protected model = Contact;
  protected filters = contactFilters;
  protected filterHandlers = ContactTransformer.filterHandlers;

  protected allowedRoles: RoleType[] = ["admin"];

  convert(contact: Contact): ExportContactDto {
    return {
      Id: contact.id,
      EmailAddress: contact.email,
      FirstName: contact.firstname,
      LastName: contact.lastname,
      Joined: contact.joined.toISOString(),
      Tags: contact.profile.tags.join(", "),
      ContributionType: contact.contributionType,
      ContributionMonthlyAmount: contact.contributionMonthlyAmount,
      ContributionPeriod: contact.contributionPeriod,
      ContributionDescription: contact.contributionDescription,
      ContributionCancelled:
        contact.paymentData.cancelledAt?.toISOString() || "",
      MembershipStarts: contact.membership?.dateAdded.toISOString() || "",
      MembershipExpires: contact.membership?.dateExpires?.toISOString() || "",
      MembershipStatus: getMembershipStatus(contact),
      NewsletterStatus: contact.profile.newsletterStatus,
      DeliveryOptIn: contact.profile.deliveryOptIn,
      DeliveryAddressLine1: contact.profile.deliveryAddress?.line1 || "",
      DeliveryAddressLine2: contact.profile.deliveryAddress?.line2 || "",
      DeliveryAddressCity: contact.profile.deliveryAddress?.city || "",
      DeliveryAddressPostcode: contact.profile.deliveryAddress?.postcode || ""
    };
  }

  protected modifyQueryBuilder(
    qb: SelectQueryBuilder<Contact>,
    fieldPrefix: string
  ): void {
    qb.orderBy(`${fieldPrefix}joined`);
    qb.leftJoinAndSelect(`${fieldPrefix}roles`, "roles");
    qb.leftJoinAndSelect(`${fieldPrefix}profile`, "profile");
    qb.leftJoinAndSelect(`${fieldPrefix}paymentData`, "pd");
  }

  async export(
    caller: Contact | undefined,
    query?: GetExportQuery
  ): Promise<[string, string]> {
    const result = await this.fetch(caller, { limit: -1, ...query });

    const exportName = `contacts-${new Date().toISOString()}.csv`;
    return [exportName, stringify(result.items, { header: true })];
  }
}

export default new ContactExporter();

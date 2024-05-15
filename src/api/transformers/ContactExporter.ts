import { RoleType } from "@beabee/beabee-common";
import { stringify } from "csv-stringify/sync";
import { SelectQueryBuilder } from "typeorm";

import { getMembershipStatus } from "@core/services/PaymentService";

import { GetExportQuery } from "@api/dto/BaseDto";
import { ExportContactDto } from "@api/dto/ContactDto";

import Contact from "@models/Contact";

import { AuthInfo } from "@type/auth-info";
import { BaseContactTransformer } from "./BaseContactTransformer";

class ContactExporter extends BaseContactTransformer<
  ExportContactDto,
  GetExportQuery
> {
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
      ContributionMonthlyAmount: contact.contribution.monthlyAmount,
      ContributionPeriod: contact.contribution.period,
      ContributionDescription: contact.contribution.description,
      ContributionCancelled:
        contact.contribution.cancelledAt?.toISOString() || "",
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
    qb.leftJoinAndSelect(`${fieldPrefix}contribution`, "contribution");
  }

  async export(
    auth: AuthInfo | undefined,
    query?: GetExportQuery
  ): Promise<[string, string]> {
    const result = await this.fetch(auth, { limit: -1, ...query });

    const exportName = `contacts-${new Date().toISOString()}.csv`;
    return [exportName, stringify(result.items, { header: true })];
  }
}

export default new ContactExporter();

import { TransformPlainToInstance } from "class-transformer";
import { SelectQueryBuilder } from "typeorm";

import { createQueryBuilder } from "@core/database";
import PaymentService from "@core/services/PaymentService";

import Contact from "@models/Contact";
import ContactRole from "@models/ContactRole";
import {
  GetContactDto,
  GetContactOptsDto,
  ListContactsDto
} from "@api/dto/ContactDto";
import ContactRoleTransformer from "@api/transformers/ContactRoleTransformer";
import ContactProfileTransformer from "@api/transformers/ContactProfileTransformer";
import { mergeRules } from "@api/utils/rules";

import { GetContactWith } from "@enums/get-contact-with";

import { AuthInfo } from "@type/auth-info";
import { BaseContactTransformer } from "./BaseContactTransformer";

class ContactTransformer extends BaseContactTransformer<
  GetContactDto,
  GetContactOptsDto
> {
  @TransformPlainToInstance(GetContactDto)
  convert(
    contact: Contact,
    opts?: GetContactOptsDto,
    auth?: AuthInfo | undefined
  ): GetContactDto {
    return {
      id: contact.id,
      email: contact.email,
      firstname: contact.firstname,
      lastname: contact.lastname,
      joined: contact.joined,
      activeRoles: contact.activeRoles,
      ...(contact.lastSeen && {
        lastSeen: contact.lastSeen
      }),
      ...(contact.contributionAmount && {
        contributionAmount: contact.contributionAmount
      }),
      ...(contact.contributionPeriod && {
        contributionPeriod: contact.contributionPeriod
      }),
      ...(opts?.with?.includes(GetContactWith.Profile) &&
        contact.profile && {
          profile: ContactProfileTransformer.convert(
            contact.profile,
            undefined,
            auth
          )
        }),
      ...(opts?.with?.includes(GetContactWith.Roles) && {
        roles: contact.roles.map(ContactRoleTransformer.convert)
      }),
      ...(opts?.with?.includes(GetContactWith.Contribution) && {
        contribution: contact.contributionInfo
      })
    };
  }

  protected transformQuery<T extends ListContactsDto>(
    query: T,
    auth: AuthInfo | undefined
  ): T {
    return {
      ...query,
      rules: mergeRules([
        query.rules,
        !auth?.roles.includes("admin") && {
          field: "id",
          operator: "equal",
          value: ["me"]
        }
      ])
    };
  }

  protected modifyQueryBuilder(
    qb: SelectQueryBuilder<Contact>,
    fieldPrefix: string,
    query: ListContactsDto
  ): void {
    {
      if (query.with?.includes(GetContactWith.Profile)) {
        qb.innerJoinAndSelect(`${fieldPrefix}profile`, "profile");
      }

      switch (query.sort) {
        // Add member role to allow sorting by membershipStarts and membershipExpires
        case "membershipStarts":
        case "membershipExpires":
          qb.leftJoin(
            ContactRole,
            "cr",
            `cr.contactId = ${fieldPrefix}id AND cr.type = 'member'`
          )
            .addSelect("cr.dateAdded", "membershipStarts")
            .addSelect(
              "COALESCE(cr.dateExpires, '-infinity'::timestamp)",
              "membershipExpires"
            )
            .orderBy(`"${query.sort}"`, query.order || "ASC", "NULLS LAST");
          break;

        // Always put empty first/last names at the bottom
        case "firstname":
        case "lastname":
          qb.orderBy(
            `NULLIF(${fieldPrefix}${query.sort}, '')`,
            query.order || "ASC",
            "NULLS LAST"
          );
          break;
      }

      // Always sort by ID to ensure predictable offset and limit
      qb.addOrderBy(`${fieldPrefix}id`, "ASC");
    }
  }

  protected async modifyItems(
    contacts: Contact[],
    query: ListContactsDto
  ): Promise<void> {
    await loadContactRoles(contacts);

    if (
      contacts.length > 0 &&
      query.with?.includes(GetContactWith.Contribution)
    ) {
      if (contacts.length > 1) {
        throw new Error("Cannot fetch contribution for multiple contacts");
      }

      contacts[0].contributionInfo = await PaymentService.getContributionInfo(
        contacts[0]
      );
    }
  }
}

export async function loadContactRoles(contacts: Contact[]): Promise<void> {
  if (contacts.length > 0) {
    // Load roles after to ensure offset/limit work
    const roles = await createQueryBuilder(ContactRole, "cr")
      .where("cr.contactId IN (:...ids)", {
        ids: contacts.map((t) => t.id)
      })
      .getMany();
    for (const contact of contacts) {
      contact.roles = roles.filter((p) => p.contactId === contact.id);
    }
  }
}

export default new ContactTransformer();

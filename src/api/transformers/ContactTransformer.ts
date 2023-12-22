import { ContactFilterName, contactFilters } from "@beabee/beabee-common";
import { Brackets, SelectQueryBuilder } from "typeorm";

import { createQueryBuilder } from "@core/database";
import PaymentService from "@core/services/PaymentService";

import Contact from "@models/Contact";
import ContactRole from "@models/ContactRole";
import ContactProfile from "@models/ContactProfile";
import PaymentData from "@models/PaymentData";

import {
  Paginated,
  FieldHandlers,
  FieldHandler,
  mergeRules
} from "@api/data/PaginatedData";
import type {
  GetContactDto,
  GetContactOptsDto,
  ListContactsDto
} from "@api/dto/ContactDto";

import { GetContactWith } from "@enums/get-contact-with";

import { BaseTransformer } from "./BaseTransformer";
import ContactRoleTransformer from "./ContactRoleTransformer";
import ContactProfileTransformer from "./ContactProfileTransformer";

class ContactTransformer extends BaseTransformer<
  Contact,
  GetContactDto,
  ContactFilterName,
  GetContactOptsDto
> {
  protected model = Contact;
  protected filters = contactFilters;
  // TODO: make protected
  fieldHandlers = contactFieldHandlers;

  convert(
    contact: Contact,
    opts?: GetContactOptsDto,
    caller?: Contact | undefined
  ): GetContactDto {
    const activeRoles = [...contact.activeRoles];
    if (activeRoles.includes("superadmin")) {
      activeRoles.push("admin");
    }

    return {
      id: contact.id,
      email: contact.email,
      firstname: contact.firstname,
      lastname: contact.lastname,
      joined: contact.joined,
      ...(contact.lastSeen && {
        lastSeen: contact.lastSeen
      }),
      ...(contact.contributionAmount && {
        contributionAmount: contact.contributionAmount
      }),
      ...(contact.contributionPeriod && {
        contributionPeriod: contact.contributionPeriod
      }),
      activeRoles,
      ...(opts?.with?.includes(GetContactWith.Profile) &&
        contact.profile && {
          profile: ContactProfileTransformer.convert(
            contact.profile,
            undefined,
            caller
          )
        }),
      ...(opts?.with?.includes(GetContactWith.Roles) && {
        roles: contact.roles.map(ContactRoleTransformer.convert)
      }),
      ...(opts?.with?.includes(GetContactWith.Contribution) && {
        contribution: contact.contribution
      })
    };
  }

  protected transformQuery(
    query: ListContactsDto,
    caller: Contact | undefined
  ): ListContactsDto {
    return {
      ...query,
      rules: mergeRules([
        query.rules,
        !caller?.hasRole("admin") && {
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

  protected async modifyResult(
    result: Paginated<Contact>,
    query: ListContactsDto
  ): Promise<void> {
    await loadContactRoles(result.items);

    if (
      result.items.length > 0 &&
      query.with?.includes(GetContactWith.Contribution)
    ) {
      if (result.items.length > 1) {
        throw new Error("Cannot fetch contribution for multiple contacts");
      }

      result.items[0].contribution = await PaymentService.getContributionInfo(
        result.items[0]
      );
    }
  }
}

// Field handlers

function membershipField(field: keyof ContactRole): FieldHandler {
  return (qb, args) => {
    const subQb = createQueryBuilder()
      .subQuery()
      .select(`cr.contactId`)
      .from(ContactRole, "cr")
      .where(`cr.type = 'member'`)
      .andWhere(args.whereFn(`cr.${field}`));

    qb.where(`${args.fieldPrefix}id IN ${subQb.getQuery()}`);
  };
}

function profileField(field: keyof ContactProfile): FieldHandler {
  return (qb, args) => {
    const subQb = createQueryBuilder()
      .subQuery()
      .select(`profile.contactId`)
      .from(ContactProfile, "profile")
      .where(args.whereFn(`profile.${field}`));

    qb.where(`${args.fieldPrefix}id IN ${subQb.getQuery()}`);
  };
}

const activePermission: FieldHandler = (qb, args) => {
  const roleType = args.field === "activeMembership" ? "member" : args.value[0];

  const isIn =
    args.field === "activeMembership"
      ? (args.value[0] as boolean)
      : args.operator === "equal";

  const subQb = createQueryBuilder()
    .subQuery()
    .select(`cr.contactId`)
    .from(ContactRole, "cr")
    .where(`cr.type = '${roleType}'`)
    .andWhere(`cr.dateAdded <= :now`)
    .andWhere(
      new Brackets((qb) => {
        qb.where(`cr.dateExpires IS NULL`).orWhere(`cr.dateExpires > :now`);
      })
    );

  if (isIn) {
    qb.where(`${args.fieldPrefix}id IN ${subQb.getQuery()}`);
  } else {
    qb.where(`${args.fieldPrefix}id NOT IN ${subQb.getQuery()}`);
  }
};

function paymentDataField(field: string): FieldHandler {
  return (qb, args) => {
    const subQb = createQueryBuilder()
      .subQuery()
      .select(`pd.contactId`)
      .from(PaymentData, "pd")
      .where(args.whereFn(`pd.${field}`));

    qb.where(`${args.fieldPrefix}id IN ${subQb.getQuery()}`);
  };
}

const contactFieldHandlers: FieldHandlers<ContactFilterName> = {
  deliveryOptIn: profileField("deliveryOptIn"),
  newsletterStatus: profileField("newsletterStatus"),
  tags: profileField("tags"),
  activePermission,
  activeMembership: activePermission,
  membershipStarts: membershipField("dateAdded"),
  membershipExpires: membershipField("dateExpires"),
  contributionCancelled: paymentDataField("cancelledAt"),
  manualPaymentSource: (qb, args) => {
    paymentDataField("data ->> 'source'")(qb, args);
    qb.andWhere(`${args.fieldPrefix}contributionType = 'Manual'`);
  }
};

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

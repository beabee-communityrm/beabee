import { ContactFilterName, contactFilters } from "@beabee/beabee-common";
import Papa from "papaparse";
import { Brackets, createQueryBuilder } from "typeorm";

import { getMembershipStatus } from "@core/services/PaymentService";

import Contact from "@models/Contact";
import UserRole from "@models/UserRole";
import ContactProfile from "@models/ContactProfile";
import PaymentData from "@models/PaymentData";

import {
  fetchPaginated,
  Paginated,
  FieldHandlers,
  FieldHandler,
  GetPaginatedRuleGroup
} from "@api/data/PaginatedData";

import { GetContactData, GetContactsQuery, GetContactWith } from "./interface";

interface ConvertOpts {
  with: GetContactWith[] | undefined;
  withRestricted: boolean;
}

export function convertContactToData(
  contact: Contact,
  opts?: ConvertOpts
): GetContactData {
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
        profile: {
          telephone: contact.profile.telephone,
          twitter: contact.profile.twitter,
          preferredContact: contact.profile.preferredContact,
          deliveryOptIn: contact.profile.deliveryOptIn,
          deliveryAddress: contact.profile.deliveryAddress,
          newsletterStatus: contact.profile.newsletterStatus,
          newsletterGroups: contact.profile.newsletterGroups,
          ...(opts.withRestricted && {
            tags: contact.profile.tags,
            notes: contact.profile.notes,
            description: contact.profile.description
          })
        }
      }),
    ...(opts?.with?.includes(GetContactWith.Roles) && {
      roles: contact.roles.map((p) => ({
        role: p.type,
        dateAdded: p.dateAdded,
        dateExpires: p.dateExpires
      }))
    })
  };
}

// Field handlers

function membershipField(field: keyof UserRole): FieldHandler {
  return (qb, args) => {
    const subQb = createQueryBuilder()
      .subQuery()
      .select(`mp.contactId`)
      .from(UserRole, "mp")
      .where(`mp.type = 'member'`)
      .andWhere(args.whereFn(`mp.${field}`));

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
    .select(`mp.contactId`)
    .from(UserRole, "mp")
    .where(`mp.type = '${roleType}'`)
    .andWhere(`mp.dateAdded <= :now`)
    .andWhere(
      new Brackets((qb) => {
        qb.where(`mp.dateExpires IS NULL`).orWhere(`mp.dateExpires > :now`);
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
      .where(args.whereFn(field));

    qb.where(`${args.fieldPrefix}id IN ${subQb.getQuery()}`);
  };
}

export const contactFieldHandlers: FieldHandlers<ContactFilterName> = {
  deliveryOptIn: profileField("deliveryOptIn"),
  newsletterStatus: profileField("newsletterStatus"),
  tags: profileField("tags"),
  activePermission,
  activeMembership: activePermission,
  membershipStarts: membershipField("dateAdded"),
  membershipExpires: membershipField("dateExpires"),
  contributionCancelled: paymentDataField(
    "(pd.data ->> 'cancelledAt')::timestamp"
  ),
  manualPaymentSource: (qb, args) => {
    paymentDataField("pd.data ->> 'source'")(qb, args);
    qb.andWhere(`${args.fieldPrefix}contributionType = 'Manual'`);
  }
};

export async function exportContacts(
  rules: GetPaginatedRuleGroup | undefined
): Promise<[string, string]> {
  const exportName = `contacts-${new Date().toISOString()}.csv`;

  const results = await fetchPaginated(
    Contact,
    contactFilters,
    { limit: -1, ...(rules && { rules }) },
    undefined,
    contactFieldHandlers,
    (qb, fieldPrefix) => {
      qb.orderBy(`${fieldPrefix}joined`);
      qb.leftJoinAndSelect(`${fieldPrefix}roles`, "roles");
      qb.leftJoinAndSelect(`${fieldPrefix}profile`, "profile");
      qb.leftJoinAndSelect(`${fieldPrefix}paymentData`, "pd");
    }
  );

  const exportData = results.items.map((contact) => {
    const hasCancelled =
      "cancelledAt" in contact.paymentData.data &&
      !!contact.paymentData.data.cancelledAt;

    return {
      Id: contact.id,
      EmailAddress: contact.email,
      FirstName: contact.firstname,
      LastName: contact.lastname,
      Joined: contact.joined,
      Tags: contact.profile.tags.join(", "),
      ContributionType: contact.contributionType,
      ContributionMonthlyAmount: contact.contributionMonthlyAmount,
      ContributionPeriod: contact.contributionPeriod,
      ContributionDescription: contact.contributionDescription,
      MembershipStarts: contact.membership?.dateAdded,
      MembershipExpires: contact.membership?.dateExpires,
      MembershipStatus: getMembershipStatus(contact, hasCancelled),
      NewsletterStatus: contact.profile.newsletterStatus,
      DeliveryOptIn: contact.profile.deliveryOptIn,
      DeliveryAddressLine1: contact.profile.deliveryAddress?.line1 || "",
      DeliveryAddressLine2: contact.profile.deliveryAddress?.line2 || "",
      DeliveryAddressCity: contact.profile.deliveryAddress?.city || "",
      DeliveryAddressPostcode: contact.profile.deliveryAddress?.postcode || ""
    };
  });

  return [exportName, Papa.unparse(exportData)];
}

export async function fetchPaginatedContacts(
  query: GetContactsQuery,
  opts: Omit<ConvertOpts, "with">
): Promise<Paginated<GetContactData>> {
  const results = await fetchPaginated(
    Contact,
    contactFilters,
    query,
    undefined, // No contact rules in contactFilters
    contactFieldHandlers,
    (qb, fieldPrefix) => {
      if (query.with?.includes(GetContactWith.Profile)) {
        qb.innerJoinAndSelect(`${fieldPrefix}profile`, "profile");
      }

      // Put empty names at the bottom
      qb.addSelect(`NULLIF(${fieldPrefix}firstname, '')`, "firstname");
      qb.addSelect(`NULLIF(${fieldPrefix}lastname, '')`, "lastname");

      if (
        query.sort === "membershipStarts" ||
        query.sort === "membershipExpires"
      ) {
        qb.leftJoin(
          UserRole,
          "mp",
          `mp.contactId = ${fieldPrefix}id AND mp.type = 'member'`
        )
          .addSelect(
            "COALESCE(mp.dateAdded, '-infinity'::timestamp)",
            "membershipStarts"
          )
          .addSelect(
            "COALESCE(mp.dateExpires, '-infinity'::timestamp)",
            "membershipExpires"
          )
          .orderBy(`"${query.sort}"`, query.order || "ASC");
      } else if (query.sort === "firstname" || query.sort === "lastname") {
        // Override the sort order to use the NULLIF(...) variants
        qb.orderBy(query.sort, query.order || "ASC");
      } else {
        qb.addOrderBy("firstname", "ASC");
      }

      // Always sort by ID to ensure predictable offset and limit
      qb.addOrderBy(`${fieldPrefix}id`, "ASC");
    }
  );

  // Load roles after to ensure offset/limit work
  await loadUserRoles(results.items);

  return {
    ...results,
    items: results.items.map((item) =>
      convertContactToData(item, { ...opts, with: query.with })
    )
  };
}

export async function loadUserRoles(contacts: Contact[]): Promise<void> {
  if (contacts.length > 0) {
    // Load roles after to ensure offset/limit work
    const roles = await createQueryBuilder(UserRole, "mp")
      .where("mp.contactId IN (:...ids)", {
        ids: contacts.map((t) => t.id)
      })
      .loadAllRelationIds()
      .getMany();
    for (const contact of contacts) {
      contact.roles = roles.filter((p) => (p.user as any) === contact.id);
    }
  }
}

export * from "./interface";

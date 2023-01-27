import { ContactFilterName, contactFilters } from "@beabee/beabee-common";
import { Brackets, createQueryBuilder } from "typeorm";

import Contact from "@models/Contact";
import ContactRole from "@models/ContactRole";
import ContactProfile from "@models/ContactProfile";
import PaymentData from "@models/PaymentData";

import {
  fetchPaginated,
  Paginated,
  FieldHandlers,
  FieldHandler
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

function membershipField(field: keyof ContactRole): FieldHandler {
  return (qb, args) => {
    const subQb = createQueryBuilder()
      .subQuery()
      .select(`mp.contactId`)
      .from(ContactRole, "mp")
      .where(`mp.type = 'member'`)
      .andWhere(args.whereFn(`mp.${field}`));

    qb.where("item.id IN " + subQb.getQuery());
  };
}

function profileField(field: keyof ContactProfile): FieldHandler {
  return (qb, args) => {
    const subQb = createQueryBuilder()
      .subQuery()
      .select(`profile.contactId`)
      .from(ContactProfile, "profile")
      .where(args.whereFn(`profile.${field}`));

    qb.where("item.id IN " + subQb.getQuery());
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
    .from(ContactRole, "mp")
    .where(`mp.type = '${roleType}'`)
    .andWhere(`mp.dateAdded <= :now`)
    .andWhere(
      new Brackets((qb) => {
        qb.where(`mp.dateExpires IS NULL`).orWhere(`mp.dateExpires > :now`);
      })
    );

  if (isIn) {
    qb.where("item.id IN " + subQb.getQuery());
  } else {
    qb.where("item.id NOT IN " + subQb.getQuery());
  }
};

function paymentDataField(field: string): FieldHandler {
  return (qb, args) => {
    const subQb = createQueryBuilder()
      .subQuery()
      .select(`pd.contactId`)
      .from(PaymentData, "pd")
      .where(args.whereFn(field));

    qb.where("item.id IN " + subQb.getQuery());
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
    qb.andWhere("item.contributionType = 'Manual'");
  }
};

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
    (qb) => {
      if (query.with?.includes(GetContactWith.Profile)) {
        qb.innerJoinAndSelect("item.profile", "profile");
      }

      // Put empty names at the bottom
      qb.addSelect("NULLIF(item.firstname, '')", "firstname");
      qb.addSelect("NULLIF(item.lastname, '')", "lastname");

      if (
        query.sort === "membershipStarts" ||
        query.sort === "membershipExpires"
      ) {
        qb.leftJoin(
          ContactRole,
          "mp",
          "mp.contactId = item.id AND mp.type = 'member'"
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
      qb.addOrderBy("item.id", "ASC");
    }
  );

  if (results.items.length > 0) {
    // Load roles after to ensure offset/limit work
    const roles = await createQueryBuilder(ContactRole, "mp")
      .where("mp.contactId IN (:...ids)", {
        ids: results.items.map((t) => t.id)
      })
      .loadAllRelationIds()
      .getMany();
    for (const item of results.items) {
      item.roles = roles.filter((p) => (p.contact as any) === item.id);
    }
  }

  return {
    ...results,
    items: results.items.map((item) =>
      convertContactToData(item, { ...opts, with: query.with })
    )
  };
}

export * from "./interface";

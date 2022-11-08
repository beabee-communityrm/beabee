import { contactFilters } from "@beabee/beabee-common";
import { Brackets, createQueryBuilder, WhereExpressionBuilder } from "typeorm";

import Member from "@models/Member";
import MemberPermission from "@models/MemberPermission";
import MemberProfile from "@models/MemberProfile";
import PaymentData from "@models/PaymentData";

import {
  fetchPaginated,
  Paginated,
  RichRuleValue,
  SpecialFields
} from "@api/data/PaginatedData";

import { GetMemberData, GetMembersQuery, GetMemberWith } from "./interface";

interface ConvertOpts {
  with: GetMemberWith[] | undefined;
  withRestricted: boolean;
}

export function convertMemberToData(
  member: Member,
  opts: ConvertOpts
): GetMemberData {
  const activeRoles = [...member.activePermissions];
  if (activeRoles.includes("superadmin")) {
    activeRoles.push("admin");
  }

  return {
    id: member.id,
    email: member.email,
    firstname: member.firstname,
    lastname: member.lastname,
    joined: member.joined,
    ...(member.lastSeen && {
      lastSeen: member.lastSeen
    }),
    ...(member.contributionAmount && {
      contributionAmount: member.contributionAmount
    }),
    ...(member.contributionPeriod && {
      contributionPeriod: member.contributionPeriod
    }),
    activeRoles,
    ...(opts.with?.includes(GetMemberWith.Profile) &&
      member.profile && {
        profile: {
          telephone: member.profile.telephone,
          twitter: member.profile.twitter,
          preferredContact: member.profile.preferredContact,
          deliveryOptIn: member.profile.deliveryOptIn,
          deliveryAddress: member.profile.deliveryAddress,
          newsletterStatus: member.profile.newsletterStatus,
          newsletterGroups: member.profile.newsletterGroups,
          ...(opts.withRestricted && {
            tags: member.profile.tags,
            notes: member.profile.notes,
            description: member.profile.description
          })
        }
      }),
    ...(opts.with?.includes(GetMemberWith.Roles) && {
      roles: member.permissions.map((p) => ({
        role: p.permission,
        dateAdded: p.dateAdded,
        dateExpires: p.dateExpires
      }))
    })
  };
}

function membershipField(field: keyof MemberPermission) {
  return (
    qb: WhereExpressionBuilder,
    args: { whereFn: (field: string) => string }
  ) => {
    const subQb = createQueryBuilder()
      .subQuery()
      .select(`mp.memberId`)
      .from(MemberPermission, "mp")
      .where(`mp.permission = 'member'`)
      .andWhere(args.whereFn(`mp.${field}`));

    qb.where("item.id IN " + subQb.getQuery());
  };
}

function profileField(field: keyof MemberProfile) {
  return (
    qb: WhereExpressionBuilder,
    args: { whereFn: (field: string) => string }
  ) => {
    const subQb = createQueryBuilder()
      .subQuery()
      .select(`profile.memberId`)
      .from(MemberProfile, "profile")
      .where(args.whereFn(`profile.${field}`));

    qb.where("item.id IN " + subQb.getQuery());
  };
}

function activePermission(
  qb: WhereExpressionBuilder,
  args: { field: string; values: RichRuleValue[] }
) {
  const permission =
    args.field === "activeMembership" ? "member" : args.values[0];

  const subQb = createQueryBuilder()
    .subQuery()
    .select(`mp.memberId`)
    .from(MemberPermission, "mp")
    .where(`mp.permission = '${permission}'`)
    .andWhere(`mp.dateAdded <= :now`)
    .andWhere(
      new Brackets((qb) => {
        qb.where(`mp.dateExpires IS NULL`).orWhere(`mp.dateExpires > :now`);
      })
    );

  if (args.field === "activePermission" || args.values[0] === true) {
    qb.where("item.id IN " + subQb.getQuery());
  } else {
    qb.where("item.id NOT IN " + subQb.getQuery());
  }
}

function paymentDataField(field: string) {
  return (
    qb: WhereExpressionBuilder,
    args: { whereFn: (field: string) => string }
  ) => {
    const subQb = createQueryBuilder()
      .subQuery()
      .select(`pd.memberId`)
      .from(PaymentData, "pd")
      .where(args.whereFn(field));

    qb.where("item.id IN " + subQb.getQuery());
  };
}

export async function fetchPaginatedMembers(
  query: GetMembersQuery,
  opts: Omit<ConvertOpts, "with">
): Promise<Paginated<GetMemberData>> {
  const results = await fetchPaginated(
    Member,
    contactFilters,
    query,
    undefined, // No contact rules in contactFilters
    {
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
      manualPaymentSource: (qb, { whereFn }) => {
        paymentDataField("pd.data ->> 'source'")(qb, { whereFn });
        qb.andWhere("item.contributionType = 'Manual'");
      }
    },
    (qb) => {
      if (query.with?.includes(GetMemberWith.Profile)) {
        qb.innerJoinAndSelect("item.profile", "profile");
      }

      // Put empty names at the bottom
      qb.addSelect("NULLIF(item.firstname, '')", "firstname");

      if (
        query.sort === "membershipStarts" ||
        query.sort === "membershipExpires"
      ) {
        qb.leftJoin(
          MemberPermission,
          "mp",
          "mp.memberId = item.id AND mp.permission = 'member'"
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
      } else if (query.sort === "firstname") {
        // Override "item.firstname"
        qb.orderBy("firstname", query.order || "ASC");
      } else {
        qb.addOrderBy("firstname", "ASC");
      }

      // Always sort by ID to ensure predictable offset and limit
      qb.addOrderBy("item.id", "ASC");
    }
  );

  if (results.items.length > 0) {
    // Load permissions after to ensure offset/limit work
    const permissions = await createQueryBuilder(MemberPermission, "mp")
      .where("mp.memberId IN (:...ids)", {
        ids: results.items.map((t) => t.id)
      })
      .loadAllRelationIds()
      .getMany();
    for (const item of results.items) {
      item.permissions = permissions.filter(
        (p) => (p.member as any) === item.id
      );
    }
  }

  return {
    ...results,
    items: results.items.map((item) =>
      convertMemberToData(item, { ...opts, with: query.with })
    )
  };
}

export * from "./interface";

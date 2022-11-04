import { Brackets, createQueryBuilder, WhereExpressionBuilder } from "typeorm";

import Member from "@models/Member";
import MemberPermission from "@models/MemberPermission";
import MemberProfile from "@models/MemberProfile";
import PaymentData from "@models/PaymentData";

import {
  fetchPaginated,
  Paginated,
  RichRuleValue
} from "@api/data/PaginatedData";

import { GetMemberData, GetMembersQuery, GetMemberWith } from "./interface";
import { contactFilters, ValidatedRule } from "@beabee/beabee-common";

interface ConvertOpts {
  with?: GetMemberWith[] | undefined;
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
    args: {
      suffix: string;
      where: string;
    }
  ) => {
    const table = "mp" + args.suffix;
    const subQb = createQueryBuilder()
      .subQuery()
      .select(`${table}.memberId`)
      .from(MemberPermission, table)
      .where(
        `${table}.permission = 'member' AND ${table}.${field} ${args.where}`
      );

    qb.where("item.id IN " + subQb.getQuery());
  };
}

function profileField(field: keyof MemberProfile) {
  return (
    qb: WhereExpressionBuilder,
    args: {
      suffix: string;
      where: string;
    }
  ) => {
    const table = "profile" + args.suffix;
    const subQb = createQueryBuilder()
      .subQuery()
      .select(`${table}.memberId`)
      .from(MemberProfile, table)
      .where(`${table}.${field} ${args.where}`);

    qb.where("item.id IN " + subQb.getQuery());
  };
}

function activePermission(
  qb: WhereExpressionBuilder,
  args: {
    field: string;
    suffix: string;
    values: RichRuleValue[];
  }
) {
  const table = "mp" + args.suffix;

  const permission =
    args.field === "activeMembership" ? "member" : args.values[0];

  const subQb = createQueryBuilder()
    .subQuery()
    .select(`${table}.memberId`)
    .from(MemberPermission, table)
    .where(
      `${table}.permission = '${permission}' AND ${table}.dateAdded <= :now`
    )
    .andWhere(
      new Brackets((qb) => {
        qb.where(`${table}.dateExpires IS NULL`).orWhere(
          `${table}.dateExpires > :now`
        );
      })
    );

  if (args.field === "activePermission" || args.values[0] === true) {
    qb.where("item.id IN " + subQb.getQuery());
  } else {
    qb.where("item.id NOT IN " + subQb.getQuery());
  }
}

export async function fetchPaginatedMembers(
  query: GetMembersQuery,
  opts: ConvertOpts
): Promise<Paginated<GetMemberData>> {
  const results = await fetchPaginated(
    Member,
    contactFilters,
    query,
    undefined, // No contact rules in contactFilters
    {
      deliveryOptIn: profileField("deliveryOptIn"),
      newsletterStatus: profileField("newsletterStatus"),
      tags: (qb, { operator, suffix }) => {
        /* TODO: support enums properly */
        switch (operator) {
          case "contains":
            return profileField("tags")(qb, { suffix, where: `? :a${suffix}` });
          case "not_contains":
            return profileField("tags")(qb, {
              suffix,
              where: `? :a${suffix} = FALSE`
            });
          case "is_empty":
            return profileField("tags")(qb, { suffix, where: `->> 0 IS NULL` });
          case "is_not_empty":
            return profileField("tags")(qb, {
              suffix,
              where: `->> 0 IS NOT NULL`
            });
        }
      },
      activePermission,
      activeMembership: activePermission,
      membershipStarts: membershipField("dateAdded"),
      membershipExpires: membershipField("dateExpires"),
      manualPaymentSource: (qb, { suffix, where }) => {
        const table = "pd" + suffix;
        const subQb = createQueryBuilder()
          .subQuery()
          .select(`${table}.memberId`)
          .from(PaymentData, table)
          .where(`${table}.data ->> 'source' ${where}`);

        qb.where("item.id IN " + subQb.getQuery()).andWhere(
          "item.contributionType = 'Manual'"
        );
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
    items: results.items.map((item) => convertMemberToData(item, opts))
  };
}

export * from "./interface";

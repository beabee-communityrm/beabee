import moment from "moment";
import { BadRequestError } from "routing-controllers";
import { Brackets, createQueryBuilder, WhereExpressionBuilder } from "typeorm";

import { Rule } from "@core/utils/newRules";

import Member from "@models/Member";
import MemberPermission from "@models/MemberPermission";
import MemberProfile from "@models/MemberProfile";
import PaymentData from "@models/PaymentData";

import { fetchPaginated, Paginated } from "@api/utils/pagination";

import { GetMemberData, GetMembersQuery, GetMemberWith } from "./interface";

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

function membershipField<Field extends string>(field: keyof MemberPermission) {
  return (
    rule: Rule<Field>,
    qb: WhereExpressionBuilder,
    suffix: string,
    namedWhere: string
  ) => {
    const table = "mp" + suffix;
    const subQb = createQueryBuilder()
      .subQuery()
      .select(`${table}.memberId`)
      .from(MemberPermission, table)
      .where(
        `${table}.permission = 'member' AND ${table}.${field} ${namedWhere}`
      );

    qb.where("item.id IN " + subQb.getQuery());
  };
}

function profileField<Field extends string>(field: keyof MemberProfile) {
  return (
    rule: Rule<Field>,
    qb: WhereExpressionBuilder,
    suffix: string,
    namedWhere: string
  ) => {
    const table = "profile" + suffix;
    const subQb = createQueryBuilder()
      .subQuery()
      .select(`${table}.memberId`)
      .from(MemberProfile, table)
      .where(`${table}.${field} ${namedWhere}`);

    qb.where("item.id IN " + subQb.getQuery());
  };
}

function activePermission<Field extends string>(
  rule: Rule<Field>,
  qb: WhereExpressionBuilder,
  suffix: string
) {
  const table = "mp" + suffix;
  const value = Array.isArray(rule.value) ? rule.value[0] : rule.value;

  const permission = rule.field === "activeMembership" ? "member" : value;

  const subQb = createQueryBuilder()
    .subQuery()
    .select(`${table}.memberId`)
    .from(MemberPermission, table)
    .where(
      `${table}.permission = '${permission}' AND ${table}.dateAdded <= :now${suffix}`
    )
    .andWhere(
      new Brackets((qb) => {
        qb.where(`${table}.dateExpires IS NULL`).orWhere(
          `${table}.dateExpires > :now${suffix}`
        );
      })
    );

  if (rule.field === "activePermission" || value === true) {
    qb.where("item.id IN " + subQb.getQuery());
  } else {
    qb.where("item.id NOT IN " + subQb.getQuery());
  }

  return {
    now: moment.utc().toDate()
  };
}

export async function fetchPaginatedMembers(
  query: GetMembersQuery,
  opts: ConvertOpts
): Promise<Paginated<GetMemberData>> {
  const results = await fetchPaginated(
    Member,
    query,
    {
      deliveryOptIn: profileField("deliveryOptIn"),
      newsletterStatus: profileField("newsletterStatus"),
      tags: (rule, qb, suffix) => {
        if (rule.operator === "contains") {
          profileField("tags")(rule, qb, suffix, `? :value${suffix}`);
          return {
            value: rule.value
          };
        }
      },
      activePermission,
      activeMembership: activePermission,
      membershipStarts: membershipField("dateAdded"),
      membershipExpires: membershipField("dateExpires"),
      manualPaymentSource: (rule, qb, suffix, namedWhere) => {
        const table = "pd" + suffix;
        const subQb = createQueryBuilder()
          .subQuery()
          .select(`${table}.memberId`)
          .from(PaymentData, table)
          .where(`${table}.data ->> 'source' ${namedWhere}`);

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

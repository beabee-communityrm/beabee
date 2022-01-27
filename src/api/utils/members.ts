import { createQueryBuilder } from "typeorm";
import {
  GetMemberData,
  GetMembersQuery,
  GetMemberWith
} from "@api/data/MemberData";
import Member from "@models/Member";
import MemberPermission from "@models/MemberPermission";
import { buildRuleQuery } from "@core/utils/rules";

interface MemberToDataOpts {
  withRestricted: boolean;
}

export function memberToData(
  member: Member,
  opts: MemberToDataOpts
): GetMemberData {
  const roles = [...member.activePermissions];
  if (roles.includes("superadmin")) {
    roles.push("admin");
  }

  return {
    id: member.id,
    email: member.email,
    firstname: member.firstname,
    lastname: member.lastname,
    joined: member.joined,
    ...(member.contributionAmount && {
      contributionAmount: member.contributionAmount
    }),
    ...(member.contributionPeriod && {
      contributionPeriod: member.contributionPeriod
    }),
    roles,
    ...(member.profile && {
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
    })
  };
}

export async function fetchPaginatedMembers(
  query: GetMembersQuery,
  opts: MemberToDataOpts
) {
  const limit = query.limit || 50;
  const offset = query.offset || 0;

  const qb = createQueryBuilder(Member, "m");
  if (query.rules) {
    buildRuleQuery(qb, query.rules);
  }
  if (query.with?.includes(GetMemberWith.Profile)) {
    qb.innerJoinAndSelect("m.profile", "profile");
  }

  const [targets, total] = await qb
    // Force empty names to be last
    .addSelect("NULLIF(m.firstname, '')", "firstname")
    .orderBy({
      [query.sort || "firstname"]: query.order || "ASC",
      firstname: "ASC",
      // Always sort by ID to ensure predictable offset and limit
      "m.id": "ASC"
    })
    .offset(offset)
    .limit(limit)
    .getManyAndCount();

  if (targets.length > 0) {
    // Load permissions after to ensure offset/limit work
    const permissions = await createQueryBuilder(MemberPermission, "mp")
      .where("mp.memberId IN (:...ids)", { ids: targets.map((t) => t.id) })
      .loadAllRelationIds()
      .getMany();
    for (const target of targets) {
      target.permissions = permissions.filter(
        (p) => (p.member as any) === target.id
      );
    }
  }

  return {
    total,
    offset,
    count: targets.length,
    items: targets.map((target) => memberToData(target, opts))
  };
}

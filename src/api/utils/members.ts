import { createQueryBuilder, SelectQueryBuilder } from "typeorm";
import {
  GetMemberData,
  GetMembersQuery,
  GetMemberWith
} from "@api/data/MemberData";
import Member from "@models/Member";
import MemberPermission from "@models/MemberPermission";

export function memberToData(
  member: Member,
  opts: {
    withRestricted: boolean;
  }
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
  qb: SelectQueryBuilder<Member>,
  query: GetMembersQuery
) {
  const limit = query.limit || 50;
  const offset = query.offset || 0;

  if (query.with?.includes(GetMemberWith.Profile)) {
    qb.innerJoinAndSelect("m.profile", "profile");
  }

  const [targets, total] = await qb
    .orderBy({
      [query.sort || "m.firstname"]: query.order || "ASC",
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
    items: targets.map((target) =>
      memberToData(target, { withRestricted: true })
    )
  };
}

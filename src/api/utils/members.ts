import { createQueryBuilder } from "typeorm";
import {
  GetMemberData,
  GetMembersQuery,
  GetMemberWith
} from "@api/data/MemberData";
import Member from "@models/Member";
import MemberPermission from "@models/MemberPermission";
import { fetchPaginated, Paginated } from "./pagination";

interface MemberToDataOpts {
  with?: GetMemberWith[] | undefined;
  withRestricted: boolean;
}

export function memberToData(
  member: Member,
  opts: MemberToDataOpts
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
): Promise<Paginated<GetMemberData>> {
  const results = await fetchPaginated(Member, query, (qb) => {
    if (query.with?.includes(GetMemberWith.Profile)) {
      qb.innerJoinAndSelect("item.profile", "profile");
    }

    // Put empty names at the bottom
    qb.addSelect("NULLIF(item.firstname, '')", "firstname");
    if (query.sort !== "firstname") {
      qb.addOrderBy("firstname", "ASC");
    }

    // Always sort by ID to ensure predictable offset and limit
    qb.addOrderBy("item.id", "ASC");
  });

  if (results.items.length > 0) {
    // Load permissions after to ensure offset/limit work
    const permissions = await createQueryBuilder(MemberPermission, "mp")
      .where("mp.memberId IN (:...ids)", {
        ids: results.items.map((t) => t.id)
      })
      .loadAllRelationIds()
      .getMany();
    for (const target of results.items) {
      target.permissions = permissions.filter(
        (p) => (p.member as any) === target.id
      );
    }
  }

  return {
    ...results,
    items: results.items.map((target) => memberToData(target, opts))
  };
}

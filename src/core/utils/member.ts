import { contactFilters, RuleGroup } from "@beabee/beabee-common";
import { Request, Response } from "express";
import { SelectQueryBuilder } from "typeorm";

import Member from "@models/Member";

import { buildPaginatedQuery } from "@api/data/PaginatedData";

export function loginAndRedirect(
  req: Request,
  res: Response,
  member: Member,
  url?: string
): void {
  req.login(member as Express.User, function (loginError) {
    if (loginError) {
      throw loginError;
    } else {
      res.redirect(url || "/");
    }
  });
}

export function generateMemberCode(member: Partial<Member>): string | null {
  if (member.firstname && member.lastname) {
    const no = ("000" + Math.floor(Math.random() * 1000)).slice(-3);
    return (member.firstname[0] + member.lastname[0] + no).toUpperCase();
  }
  return null;
}

export function buildQuery(
  ruleGroup?: RuleGroup<string>
): SelectQueryBuilder<Member> {
  return buildPaginatedQuery(Member, contactFilters, ruleGroup);
}

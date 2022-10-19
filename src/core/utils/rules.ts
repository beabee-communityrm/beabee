import { contactFilters } from "@beabee/beabee-common";
import { SelectQueryBuilder } from "typeorm";

import Member from "@models/Member";

import { buildRuleQuery, RuleGroup } from "./newRules";

export function buildQuery(
  ruleGroup?: RuleGroup<string>
): SelectQueryBuilder<Member> {
  const qb = buildRuleQuery(Member, contactFilters, ruleGroup);
  qb.leftJoinAndSelect("m.permissions", "mp");
  qb.innerJoinAndSelect("m.profile", "profile");
  return qb;
}

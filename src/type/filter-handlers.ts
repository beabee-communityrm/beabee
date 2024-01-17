import { FilterType, RuleOperator, RuleValue } from "@beabee/beabee-common";
import { WhereExpressionBuilder } from "typeorm";

export type RichRuleValue = RuleValue | Date;

export type FilterHandler = (
  qb: WhereExpressionBuilder,
  args: {
    fieldPrefix: string;
    type: FilterType;
    field: string;
    operator: RuleOperator;
    value: RichRuleValue[];
    whereFn: (field: string) => string;
    suffixFn: (field: string) => string;
  }
) => void | Record<string, unknown>;

export type FilterHandlers<Field extends string> = {
  [K in Field]?: FilterHandler;
};

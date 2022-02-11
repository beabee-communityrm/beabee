import {
  isRuleGroup,
  Rule,
  RuleGroup,
  RuleOperator,
  RuleValue
} from "@core/utils/rules";
import {
  plainToClass,
  Transform,
  TransformFnParams,
  Type
} from "class-transformer";
import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested
} from "class-validator";

function transformRules({
  value
}: TransformFnParams): GetPaginatedRuleGroup | GetPaginatedRule {
  return value.map((v: any) => {
    if (isRuleGroup(v)) {
      return plainToClass(GetPaginatedRuleGroup, v);
    } else {
      return plainToClass(GetPaginatedRule, v);
    }
  });
}

class GetPaginatedRule implements Rule {
  @IsString()
  field!: string;

  // TODO: operator validation
  @IsString()
  operator!: RuleOperator;

  // TODO: allow RuleValue[]
  @IsString()
  value!: RuleValue | RuleValue[];
}

class GetPaginatedRuleGroup implements RuleGroup {
  @IsIn(["AND", "OR"])
  condition!: "AND" | "OR";

  @IsArray()
  @ValidateNested()
  @Transform(transformRules)
  rules!: (GetPaginatedRuleGroup | GetPaginatedRule)[];
}

export abstract class GetPaginatedQuery<S> {
  @IsOptional()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @Min(0)
  offset?: number;

  @IsOptional()
  sort?: S;

  @IsOptional()
  @IsIn(["ASC", "DESC"])
  order?: "ASC" | "DESC";

  @IsOptional()
  @ValidateNested()
  @Type(() => GetPaginatedRuleGroup)
  rules?: GetPaginatedRuleGroup;
}

export interface Paginated<T> {
  items: T[];
  offset: number;
  count: number;
  total: number;
}

export class UUIDParam {
  @IsUUID("4")
  id!: string;
}

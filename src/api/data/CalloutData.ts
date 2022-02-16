import {
  GetPaginatedQuery,
  GetPaginatedRule,
  GetPaginatedRuleGroup
} from "@api/utils/pagination";
import { isRuleGroup } from "@core/utils/newRules";
import {
  plainToClass,
  Transform,
  TransformFnParams,
  Type
} from "class-transformer";
import { IsBoolean, IsEnum, IsIn, IsOptional } from "class-validator";

export enum CalloutStatus {
  Open = "open",
  Finished = "finished"
}

const fields = ["title"] as const;
const sortFields = ["title"] as const;

type Field = typeof fields[number];
type SortField = typeof sortFields[number];

function transformRules({
  value
}: TransformFnParams): GetCalloutsRuleGroup | GetCalloutsRule {
  return value.map((v: any) => {
    if (isRuleGroup<Field>(v)) {
      return plainToClass(GetCalloutsRuleGroup, v);
    } else {
      return plainToClass(GetCalloutsRule, v);
    }
  });
}

class GetCalloutsRule extends GetPaginatedRule<Field> {
  @IsIn(fields)
  field!: Field;
}

class GetCalloutsRuleGroup extends GetPaginatedRuleGroup<Field> {
  @Transform(transformRules)
  rules!: (GetCalloutsRuleGroup | GetCalloutsRule)[];
}

export class GetCalloutsQuery extends GetPaginatedQuery<Field, SortField> {
  @IsIn(sortFields)
  sort?: SortField;

  @Type(() => GetCalloutsRuleGroup)
  rules?: GetCalloutsRuleGroup;

  @IsOptional()
  @IsEnum(CalloutStatus)
  status?: CalloutStatus;

  @IsOptional()
  @IsBoolean()
  answered?: boolean;
}

export interface GetBasicCalloutData {
  slug: string;
  title: string;
  excerpt: string;
  image?: string;
  starts?: Date;
  expires?: Date;
}

export interface GetMoreCalloutData extends GetBasicCalloutData {
  templateSchema?: Record<string, unknown>;
}

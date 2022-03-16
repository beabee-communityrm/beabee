import {
  GetPaginatedQuery,
  GetPaginatedRule,
  GetPaginatedRuleGroup,
  transformRules
} from "@api/utils/pagination";
import ItemStatus from "@models/ItemStatus";
import { Transform, Type } from "class-transformer";
import { IsBoolean, IsDate, IsIn, IsOptional, IsString } from "class-validator";

interface NoticeData {
  name: string;
  expires?: Date;
  text: string;
  buttonText: string;
  url?: string;
}

const fields = [
  "createdAt",
  "updatedAt",
  "name",
  "expires",
  "enabled",
  "text",
  "status"
] as const;
const sortFields = ["createdAt", "updatedAt", "name", "expires"];

type Field = typeof fields[number];
type SortField = typeof sortFields[number];

class GetNoticesRule extends GetPaginatedRule<Field> {
  @IsIn(fields)
  field!: Field;
}

class GetNoticesRuleGroup extends GetPaginatedRuleGroup<Field> {
  @Transform(transformRules(GetNoticesRuleGroup, GetNoticesRule))
  rules!: (GetNoticesRuleGroup | GetNoticesRule)[];
}

export class GetNoticesQuery extends GetPaginatedQuery<Field, SortField> {
  @IsIn(sortFields)
  sort?: SortField;

  @Type(() => GetNoticesRuleGroup)
  rules?: GetNoticesRuleGroup;
}

export interface GetNoticeData extends NoticeData {
  id: string;
  createdAt: Date;
  updatedAt: Date;
  status: ItemStatus;
}

export class CreateNoticeData implements NoticeData {
  @IsString()
  name!: string;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  expires?: Date;

  @IsBoolean()
  enabled!: boolean;

  @IsString()
  text!: string;

  @IsString()
  buttonText!: string;

  @IsString()
  @IsOptional()
  url?: string;
}

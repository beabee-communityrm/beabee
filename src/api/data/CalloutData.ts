import { IsBoolean, IsEnum, IsIn, IsOptional } from "class-validator";
import { GetPaginatedQuery } from ".";

export enum CalloutStatus {
  Open = "open",
  Finished = "finished"
}

export class GetCalloutsQuery extends GetPaginatedQuery<"title"> {
  @IsIn(["title"])
  sort?: "title";

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

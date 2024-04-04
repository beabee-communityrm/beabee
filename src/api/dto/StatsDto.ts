import { Type } from "class-transformer";
import { IsDate, IsNumber, IsOptional } from "class-validator";

export class GetStatsOptsDto {
  @Type(() => Date)
  @IsDate()
  from!: Date;

  @Type(() => Date)
  @IsDate()
  to!: Date;
}

export class GetStatsDto {
  @IsNumber()
  newContacts!: number;

  @IsOptional()
  @IsNumber()
  averageContribution!: number | null;

  @IsOptional()
  @IsNumber()
  totalRevenue!: number | null;
}

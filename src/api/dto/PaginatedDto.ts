import { Paginated } from "@beabee/beabee-common";
import { IsNumber, ValidateNested } from "class-validator";

export class PaginatedDto<T> implements Paginated<T> {
  @ValidateNested({ each: true })
  items!: T[];

  @IsNumber()
  total!: number;

  @IsNumber()
  offset!: number;

  @IsNumber()
  count!: number;
}

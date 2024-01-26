import { PaymentStatus } from "@beabee/beabee-common";
import { Type } from "class-transformer";
import {
  IsArray,
  IsDate,
  IsEnum,
  IsIn,
  IsNumber,
  IsOptional,
  ValidateNested
} from "class-validator";

import { GetPaginatedQuery } from "@api/dto/BaseDto";
import { GetContactDto } from "@api/dto/ContactDto";
import { PaginatedDto } from "@api/dto/PaginatedDto";

export class GetPaymentDto {
  @IsNumber()
  amount!: number;

  @IsDate()
  chargeDate!: Date;

  @IsEnum(PaymentStatus)
  status!: PaymentStatus;

  @IsOptional()
  @ValidateNested()
  @Type(() => GetContactDto)
  contact?: GetContactDto | null;
}

export class GetPaymentListDto extends PaginatedDto<GetPaymentDto> {
  @ValidateNested({ each: true })
  @Type(() => GetPaymentDto)
  items!: GetPaymentDto[];
}

export enum GetPaymentWith {
  Contact = "contact"
}

export class GetPaymentOptsDto {
  @IsArray()
  @IsOptional()
  @IsEnum(GetPaymentWith, { each: true })
  with?: GetPaymentWith[];
}

export class ListPaymentsDto extends GetPaginatedQuery {
  @IsArray()
  @IsOptional()
  @IsEnum(GetPaymentWith, { each: true })
  with?: GetPaymentWith[];

  @IsIn(["amount", "chargeDate"])
  sort?: string;
}

import { PaymentStatus } from "@beabee/beabee-common";
import { IsArray, IsEnum, IsIn, IsOptional } from "class-validator";

import { GetPaginatedQuery } from "@api/data/PaginatedData/interface";
import { GetContactDto } from "@api/dto/ContactDto";

export interface GetPaymentDto {
  amount: number;
  chargeDate: Date;
  status: PaymentStatus;
  contact?: GetContactDto | null;
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

import { PaymentStatus } from "@beabee/beabee-common";
import { IsArray, IsEnum, IsIn, IsOptional } from "class-validator";

import { GetPaginatedQuery } from "@api/data/PaginatedData";

import { GetContactData } from "@type/get-contact-data";

export interface GetPaymentDto {
  amount: number;
  chargeDate: Date;
  status: PaymentStatus;
  contact?: GetContactData | null;
}

export enum GetPaymentWith {
  Contact = "contact"
}

const paymentSortFields = ["amount", "chargeDate"] as const;
export class QueryPaymentsDto extends GetPaginatedQuery {
  @IsArray()
  @IsOptional()
  @IsEnum(GetPaymentWith, { each: true })
  with?: GetPaymentWith[];

  @IsIn(paymentSortFields)
  sort?: string;
}

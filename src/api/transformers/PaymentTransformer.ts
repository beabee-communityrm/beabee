import {
  Paginated,
  PaymentFilterName,
  paymentFilters
} from "@beabee/beabee-common";
import { SelectQueryBuilder } from "typeorm";

import { convertContactToData, loadContactRoles } from "@api/data/ContactData";
import { mergeRules } from "@api/data/PaginatedData";
import {
  GetPaymentDto,
  GetPaymentOptsDto,
  GetPaymentWith,
  ListPaymentsDto
} from "@api/dto/PaymentDto";
import { BaseTransformer } from "@api/transformers/BaseTransformer";

import Contact from "@models/Contact";
import Payment from "@models/Payment";

class PaymentTransformer extends BaseTransformer<
  Payment,
  GetPaymentDto,
  PaymentFilterName,
  GetPaymentOptsDto
> {
  model = Payment;
  filters = paymentFilters;

  convert(payment: Payment, opts: GetPaymentOptsDto): GetPaymentDto {
    return {
      amount: payment.amount,
      chargeDate: payment.chargeDate,
      status: payment.status,
      ...(opts.with?.includes(GetPaymentWith.Contact) && {
        contact: payment.contact && convertContactToData(payment.contact)
      })
    };
  }

  protected transformQuery(
    query: ListPaymentsDto,
    caller: Contact | undefined
  ): ListPaymentsDto {
    return {
      ...query,
      rules: mergeRules([
        query.rules,
        !caller?.hasRole("admin") && {
          field: "contact",
          operator: "equal",
          value: ["me"]
        }
      ])
    };
  }

  protected modifyQueryBuilder(
    qb: SelectQueryBuilder<Payment>,
    fieldPrefix: string,
    query: ListPaymentsDto
  ): void {
    if (query.with?.includes(GetPaymentWith.Contact)) {
      qb.leftJoinAndSelect(`${fieldPrefix}contact`, "contact");
    }
  }

  protected async modifyResult(
    result: Paginated<Payment>,
    query: ListPaymentsDto
  ): Promise<void> {
    if (query.with?.includes(GetPaymentWith.Contact)) {
      const contacts = result.items
        .map((item) => item.contact)
        .filter((c): c is Contact => !!c);

      await loadContactRoles(contacts);
    }
  }
}

export default new PaymentTransformer();

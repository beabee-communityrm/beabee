import {
  Paginated,
  PaymentFilterName,
  paymentFilters
} from "@beabee/beabee-common";

import Payment from "@models/Payment";

import { Transformer } from "@api/transformers";

import {
  GetPaymentData,
  GetPaymentWith,
  GetPaymentsQuery
} from "./payment.data";
import Contact from "@models/Contact";
import { mergeRules } from "@api/data/PaginatedData";
import { convertContactToData, loadContactRoles } from "@api/data/ContactData";
import { SelectQueryBuilder } from "typeorm";

class PaymentTransformer extends Transformer<
  Payment,
  GetPaymentData,
  GetPaymentsQuery,
  PaymentFilterName
> {
  model = Payment;
  filters = paymentFilters;

  convert(payment: Payment, query: GetPaymentsQuery): GetPaymentData {
    return {
      amount: payment.amount,
      chargeDate: payment.chargeDate,
      status: payment.status,
      ...(query.with?.includes(GetPaymentWith.Contact) && {
        contact: payment.contact && convertContactToData(payment.contact)
      })
    };
  }

  protected transformQuery(
    query: GetPaymentsQuery,
    runner: Contact | undefined
  ): GetPaymentsQuery {
    return {
      ...query,
      rules: mergeRules([
        query.rules,
        !runner?.hasRole("admin") && {
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
    query: GetPaymentsQuery
  ): void {
    if (query.with?.includes(GetPaymentWith.Contact)) {
      qb.leftJoinAndSelect(`${fieldPrefix}contact`, "contact");
    }
  }

  protected async modifyResult(
    result: Paginated<Payment>,
    query: GetPaymentsQuery
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

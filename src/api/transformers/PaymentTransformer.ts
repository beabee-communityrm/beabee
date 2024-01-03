import {
  Paginated,
  PaymentFilterName,
  paymentFilters
} from "@beabee/beabee-common";
import { TransformPlainToInstance } from "class-transformer";
import { SelectQueryBuilder } from "typeorm";

import {
  GetPaymentDto,
  GetPaymentOptsDto,
  GetPaymentWith,
  ListPaymentsDto
} from "@api/dto/PaymentDto";
import ContactTransformer, {
  loadContactRoles
} from "@api/transformers/ContactTransformer";
import { BaseTransformer } from "@api/transformers/BaseTransformer";
import { mergeRules } from "@api/utils/rules";

import Contact from "@models/Contact";
import Payment from "@models/Payment";

class PaymentTransformer extends BaseTransformer<
  Payment,
  GetPaymentDto,
  PaymentFilterName,
  GetPaymentOptsDto
> {
  protected model = Payment;
  protected filters = paymentFilters;

  @TransformPlainToInstance(GetPaymentDto)
  convert(payment: Payment, opts: GetPaymentOptsDto): GetPaymentDto {
    return {
      amount: payment.amount,
      chargeDate: payment.chargeDate,
      status: payment.status,
      ...(opts.with?.includes(GetPaymentWith.Contact) && {
        contact: payment.contact && ContactTransformer.convert(payment.contact)
      })
    };
  }

  protected transformQuery<T extends ListPaymentsDto>(
    query: T,
    caller: Contact | undefined
  ): T {
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

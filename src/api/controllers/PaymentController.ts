import { Paginated, fetchPaginated, mergeRules } from "@api/data/PaginatedData";
import {
  Authorized,
  CurrentUser,
  Get,
  JsonController,
  QueryParams
} from "routing-controllers";

import {
  GetPaymentData,
  GetPaymentsQuery,
  fetchPaginatedPayments
} from "@api/data/PaymentData";

import Contact from "@models/Contact";

@JsonController("/payment")
@Authorized()
export class PaymentController {
  @Get("/")
  async getPayments(
    @CurrentUser() contact: Contact,
    @QueryParams() query: GetPaymentsQuery
  ): Promise<Paginated<GetPaymentData>> {
    const authedQuery = {
      ...query,
      rules: mergeRules([
        query.rules,
        // Non-admins can only see their own payments
        !contact.hasRole("admin") && {
          field: "contact",
          operator: "equal",
          value: [contact.id]
        }
      ])
    };
    return await fetchPaginatedPayments(authedQuery, contact);
  }
}

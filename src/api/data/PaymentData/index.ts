import Payment from "@models/Payment";
import { GetPaymentData, GetPaymentWith, GetPaymentsQuery } from "./interface";
import { Paginated, paymentFilters } from "@beabee/beabee-common";
import { fetchPaginated } from "../PaginatedData";
import Contact from "@models/Contact";
import { convertContactToData, loadContactRoles } from "../ContactData";

function convertPaymentToPaymentData(
  payment: Payment,
  _with?: GetPaymentWith[]
): GetPaymentData {
  return {
    amount: payment.amount,
    chargeDate: payment.chargeDate,
    status: payment.status,
    ...(_with?.includes(GetPaymentWith.Contact) &&
      payment.contact && {
        contact: convertContactToData(payment.contact)
      })
  };
}

export async function fetchPaginatedPayments(
  query: GetPaymentsQuery,
  contact: Contact
): Promise<Paginated<GetPaymentData>> {
  const data = await fetchPaginated(
    Payment,
    paymentFilters,
    query,
    contact,
    undefined,
    (qb, fieldPrefix) => {
      if (query.with?.includes(GetPaymentWith.Contact)) {
        qb.leftJoinAndSelect(`${fieldPrefix}contact`, "contact");
      }
    }
  );

  // Load contact roles after to ensure offset/limit work
  const contacts = data.items
    .map((item) => item.contact)
    .filter((c) => !!c) as Contact[];
  await loadContactRoles(contacts);

  return {
    ...data,
    items: data.items.map((item) =>
      convertPaymentToPaymentData(item, query.with)
    )
  };
}

export * from "./interface";

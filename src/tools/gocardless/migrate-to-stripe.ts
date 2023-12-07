import "module-alias/register";

import { PaymentMethod, PaymentStatus } from "@beabee/beabee-common";
import { parse } from "csv-parse";
import { add, startOfDay, sub } from "date-fns";
import Stripe from "stripe";
import { Equal, In } from "typeorm";

import * as db from "@core/database";
import stripe from "@core/lib/stripe";
import { stripeTypeToPaymentMethod } from "@core/utils/payment/stripe";

import PaymentService from "@core/services/PaymentService";

import Contact from "@models/Contact";
import Payment from "@models/Payment";
import PaymentData, { GCPaymentData } from "@models/PaymentData";

import config from "@config";

interface MigrationRow {
  old_customer_id: string;
  customer_id: string;
  old_source_id: string;
  source_id: string;
  type: Stripe.PaymentMethod.Type;
}

const validTypes = ["sepa_debit", "card", "bacs_debit"];

const isDangerMode = process.argv.includes("--danger");

function isMigrationRow(row: any): row is MigrationRow {
  return (
    typeof row === "object" &&
    typeof row.old_customer_id === "string" &&
    typeof row.customer_id === "string" &&
    typeof row.old_source_id === "string" &&
    typeof row.source_id === "string" &&
    typeof row.type === "string" &&
    validTypes.includes(row.type)
  );
}

async function loadMigrationData(): Promise<MigrationRow[]> {
  return new Promise((resolve) => {
    const rows: MigrationRow[] = [];

    process.stdin
      .pipe(parse({ columns: true }))
      .on("data", async (row: any) => {
        if (isMigrationRow(row)) {
          rows.push(row);
        } else {
          console.error("Invalid row", row);
        }
      })
      .on("end", () => resolve(rows));

    return rows;
  });
}

db.connect().then(async () => {
  const now = new Date();

  const minPaymentDate = startOfDay(add(now, config.gracePeriod));
  const maxPaymentDate = add(minPaymentDate, { days: 5 });

  const migrationData = await loadMigrationData();

  const contacts = await db
    .createQueryBuilder(Contact, "contact")
    // Only select those that are't renewing in the next 5 days
    .innerJoinAndSelect(
      "contact.roles",
      "r",
      "r.type = 'member' AND r.dateAdded <= :now AND r.dateExpires NOT BETWEEN :min AND :max",
      { now, min: minPaymentDate, max: maxPaymentDate }
    )
    // Only select those which haven't cancelled and use GoCardless
    .innerJoinAndSelect(
      "contact.paymentData",
      "pd",
      "pd.cancelledAt IS NULL AND pd.method = :method",
      { method: PaymentMethod.GoCardlessDirectDebit }
    )
    .getMany();

  console.log("Found", contacts.length, "contacts");

  const payments = await db.getRepository(Payment).find({
    where: {
      contactId: In(contacts.map((c) => c.id)),
      status: Equal(PaymentStatus.Pending)
    },
    loadRelationIds: true
  });

  for (const contact of contacts) {
    const contactPayments = payments.filter(
      (p) => (p.contact as any) === contact.id
    );

    const paymentData = contact.paymentData.data as GCPaymentData;

    const migrationRow = migrationData.find(
      (row) => row.old_customer_id === paymentData.customerId
    );

    if (!migrationRow) {
      console.error("ERROR: Contact has no migration row", contact.email);
    } else if (migrationRow.old_source_id !== paymentData.mandateId) {
      console.error(
        "ERROR: mandate ID doesn't match one in database",
        contact.email,
        migrationRow.old_source_id,
        paymentData.mandateId
      );
    } else if (contactPayments.length > 0) {
      console.error(
        "ERROR: Contact has a pending payment",
        contact.email,
        contactPayments.length
      );
    } else if (
      !contact.contributionPeriod ||
      !contact.contributionMonthlyAmount
    ) {
      console.error(
        "ERROR: Contact doesn't have a contribution amount or period"
      );
    } else {
      console.log(
        "Will migrate",
        contact.email,
        migrationRow.old_customer_id,
        "->",
        migrationRow.customer_id
      );

      if (isDangerMode) {
        // Cancel the GoCardless contribution
        await PaymentService.cancelContribution(contact);

        // Update the payment data to point to the new Stripe customer
        // We do this directly rather than using updatePaymentMethod as it's not
        // meant for updating payment methods that are already associated with
        // the customer in Stripe
        await db.getRepository(PaymentData).update(contact.id, {
          method: stripeTypeToPaymentMethod(migrationRow.type),
          data: {
            customerId: migrationRow.customer_id,
            mandateId: migrationRow.source_id,
            subscriptionId: null,
            payFee: null,
            nextAmount: null
          }
        });

        await stripe.customers.update(migrationRow.customer_id, {
          invoice_settings: {
            default_payment_method: migrationRow.source_id
          }
        });

        // Recreate the contribution
        await PaymentService.updateContribution(contact, {
          monthlyAmount: contact.contributionMonthlyAmount,
          period: contact.contributionPeriod,
          payFee: false,
          prorate: false
        });
      }
    }
  }

  await db.close();
});

import "module-alias/register";

import { PaymentMethod } from "@beabee/beabee-common";
import { In } from "typeorm";

import { getRepository } from "@core/database";
import { runApp } from "@core/server";
import { stripe } from "@core/lib/stripe";
import ContactsService from "@core/services/ContactsService";

import PaymentData, { StripePaymentData } from "@models/PaymentData";

import {
  handleInvoicePaid,
  handleInvoiceUpdated
} from "../../webhooks/handlers/stripe";

const isDangerMode = process.argv.includes("--danger");

async function* fetchInvoices(customerId: string) {
  let hasMore = true;

  while (hasMore) {
    const invoices = await stripe.invoices.list({
      customer: customerId,
      limit: 100
    });
    hasMore = invoices.has_more;

    yield* invoices.data;
  }
}

runApp(async () => {
  const stripePaymentData = (await getRepository(PaymentData).find({
    where: {
      method: In([
        PaymentMethod.StripeBACS,
        PaymentMethod.StripeCard,
        PaymentMethod.StripeSEPA
      ])
    },
    relations: { contact: true }
  })) as (PaymentData & { data: StripePaymentData })[];

  for (const pd of stripePaymentData) {
    console.log(`# Checking ${pd.contact.email}`);
    if (!isDangerMode) {
      console.log(pd.cancelledAt, pd.data);
    }

    // Check if subscription is still valid
    if (pd.data.subscriptionId) {
      try {
        const subscription = await stripe.subscriptions.retrieve(
          pd.data.subscriptionId
        );
        if (subscription.status === "canceled") {
          console.log(`Cancelling subscription ${pd.data.subscriptionId}`);
          pd.cancelledAt = subscription.canceled_at
            ? new Date(subscription.canceled_at * 1000)
            : new Date();

          pd.data.subscriptionId = null;
        } else if (subscription.status === "incomplete_expired") {
          console.log(
            `Removing incomplete subscription ${pd.data.subscriptionId}`
          );
          pd.data.subscriptionId = null;
          if (isDangerMode) {
            await ContactsService.revokeContactRole(pd.contact, "member");
          }
        }
      } catch (e) {
        console.log(`Removing missing subscription ${pd.data.subscriptionId}`);
        pd.data.subscriptionId = null;
      }
    }

    // Check if mandate has been detached
    if (pd.data.mandateId) {
      try {
        const paymentMethod = await stripe.paymentMethods.retrieve(
          // pd.data.customerId,
          pd.data.mandateId
        );
        if (!paymentMethod.customer) {
          console.log(`Detaching payment method ${pd.data.mandateId}`);
          pd.data.mandateId = null;
        }
      } catch (e) {
        console.log(`Removing mandate ${pd.data.mandateId}`);
        pd.data.mandateId = null;
      }
    }

    if (pd.data.customerId) {
      // Update list of invoices
      for await (const invoice of fetchInvoices(pd.data.customerId)) {
        if (isDangerMode) {
          await handleInvoiceUpdated(invoice);
          if (invoice.paid) {
            await handleInvoicePaid(invoice);
          }
        } else {
          console.log(invoice.id);
        }
      }

      // Check if customer has been deleted
      const customer = await stripe.customers.retrieve(pd.data.customerId);
      if (customer.deleted) {
        console.log(`Removing deleted customer ${pd.data.customerId}`);
        pd.data.customerId = null;
        pd.data.mandateId = null;
        pd.data.subscriptionId = null;
      }
    }

    if (isDangerMode) {
      await getRepository(PaymentData).save(pd);
    } else {
      console.log(pd.cancelledAt, pd.data);
    }
  }
});

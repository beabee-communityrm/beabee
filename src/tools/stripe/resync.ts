import "module-alias/register";

import { PaymentMethod } from "@beabee/beabee-common";
import { In } from "typeorm";

import { getRepository } from "@core/database";
import { runApp } from "@core/server";
import { stripe } from "@core/lib/stripe";
import ContactsService from "@core/services/ContactsService";

import ContactContribution from "@models/ContactContribution";

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
  const contributions = await getRepository(ContactContribution).find({
    where: {
      method: In([
        PaymentMethod.StripeBACS,
        PaymentMethod.StripeCard,
        PaymentMethod.StripeSEPA
      ])
    },
    relations: { contact: true }
  });

  for (const contribution of contributions) {
    console.log(`# Checking ${contribution.contact.email}`);
    if (!isDangerMode) {
      console.log(contribution.cancelledAt, contribution);
    }

    // Check if subscription is still valid
    if (contribution.subscriptionId) {
      try {
        const subscription = await stripe.subscriptions.retrieve(
          contribution.subscriptionId
        );
        if (subscription.status === "canceled") {
          console.log(`Cancelling subscription ${contribution.subscriptionId}`);
          contribution.cancelledAt = subscription.canceled_at
            ? new Date(subscription.canceled_at * 1000)
            : new Date();

          contribution.subscriptionId = null;
        } else if (subscription.status === "incomplete_expired") {
          console.log(
            `Removing incomplete subscription ${contribution.subscriptionId}`
          );
          contribution.subscriptionId = null;
          if (isDangerMode) {
            await ContactsService.revokeContactRole(
              contribution.contact,
              "member"
            );
          }
        }
      } catch (e) {
        console.log(
          `Removing missing subscription ${contribution.subscriptionId}`
        );
        contribution.subscriptionId = null;
      }
    }

    // Check if mandate has been detached
    if (contribution.mandateId) {
      try {
        const paymentMethod = await stripe.paymentMethods.retrieve(
          // pd.data.customerId,
          contribution.mandateId
        );
        if (!paymentMethod.customer) {
          console.log(`Detaching payment method ${contribution.mandateId}`);
          contribution.mandateId = null;
        }
      } catch (e) {
        console.log(`Removing mandate ${contribution.mandateId}`);
        contribution.mandateId = null;
      }
    }

    if (contribution.customerId) {
      // Update list of invoices
      for await (const invoice of fetchInvoices(contribution.customerId)) {
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
      const customer = await stripe.customers.retrieve(contribution.customerId);
      if (customer.deleted) {
        console.log(`Removing deleted customer ${contribution.customerId}`);
        contribution.customerId = null;
        contribution.mandateId = null;
        contribution.subscriptionId = null;
      }
    }

    if (isDangerMode) {
      await getRepository(ContactContribution).save(contribution);
    } else {
      console.log(contribution.cancelledAt, contribution);
    }
  }
});

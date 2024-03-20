import bodyParser from "body-parser";
import express from "express";
import {
  Event,
  EventResourceType,
  PaymentStatus
} from "gocardless-nodejs/types/Types";

import { log as mainLogger } from "#core/logging";
import gocardless from "#core/lib/gocardless";
import { wrapAsync } from "#core/utils";
import {
  updatePaymentStatus,
  updatePayment,
  cancelSubscription,
  cancelMandate
} from "../utils/gocardless";

const log = mainLogger.child({ app: "webhook-gocardless" });

const app = express();

const textBodyParser = bodyParser.text({
  type: "application/json",
  limit: "1mb"
});

app.get("/", (req, res) => res.sendStatus(200));

app.post(
  "/",
  textBodyParser,
  wrapAsync(async (req, res) => {
    const valid = gocardless.webhooks.validate(req);

    if (valid) {
      const events = JSON.parse(req.body).events as Event[];

      log.info(`Got ${events.length} events`);

      res.sendStatus(200);

      try {
        for (const event of events) {
          log.info(
            `Got ${event.action} on ${event.resource_type}: ${JSON.stringify(
              event.links
            )}`
          );

          await handleEventResource(event);
        }
      } catch (error) {
        log.error("Error while processing events", error);
      }
    } else {
      log.error("Invalid webhook signature");
      res.sendStatus(498);
    }
  })
);

async function handleEventResource(event: Event) {
  switch (event.resource_type) {
    case EventResourceType.Payments:
      return await handlePaymentResourceEvent(event);
    case EventResourceType.Subscriptions:
      return await handleSubscriptionResourceEvent(event);
    case EventResourceType.Mandates:
      return await handleMandateResourceEvent(event);
    case EventResourceType.Refunds:
      return await handleRefundResourceEvent(event);
    default:
      log.info("Unhandled event", event);
      break;
  }
}

async function handlePaymentResourceEvent(event: Event) {
  // GC sends a paid_out action per payment when a payout is processed, which
  // means 1,000s of events.  In the docs they say you should always fetch the
  // related payment to check it hasn't changed, but if we do that we get rate
  // limited. It seems like we can pretty safely assume paid out payments
  // haven't changed though.
  if (event.action === PaymentStatus.PaidOut) {
    await updatePaymentStatus(event.links!.payment!, PaymentStatus.PaidOut);
  } else {
    await updatePayment(event.links!.payment!, event.action);
  }
}

async function handleSubscriptionResourceEvent(event: Event) {
  switch (event.action) {
    case "created":
    case "customer_approval_granted":
    case "payment_created":
    case "amended":
      // Do nothing, we already have the details on file.
      break;
    case "customer_approval_denied":
    case "cancelled":
    case "finished":
      await cancelSubscription(event.links!.subscription!);
      break;
  }
}

async function handleMandateResourceEvent(event: Event) {
  switch (event.action) {
    case "created":
    case "customer_approval_granted":
    case "customer_approval_skipped":
    case "submitted":
    case "active":
    case "transferred":
      // Do nothing, we already have the details on file.
      break;
    case "reinstated":
      log.error(
        "Mandate reinstated, its like this mandate won't be linked to a member...",
        event
      );
      break;
    case "cancelled":
    case "failed":
    case "expired":
      // Remove the mandate from the database
      await cancelMandate(event.links!.mandate!);
      break;
  }
}

async function handleRefundResourceEvent(event: Event) {
  const refund = await gocardless.refunds.get(event.links!.refund!);
  await updatePayment(refund.links!.payment!);
}

export default app;

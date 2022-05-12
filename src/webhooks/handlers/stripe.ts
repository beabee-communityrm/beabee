import bodyParser from "body-parser";
import express from "express";
import Stripe from "stripe";

import { log as mainLogger } from "@core/logging";
import stripe from "@core/lib/stripe";
import { wrapAsync } from "@core/utils";

import GiftService from "@core/services/GiftService";

import config from "@config";
import JoinFlowService from "@core/services/JoinFlowService";

const log = mainLogger.child({ app: "webhook-stripe" });

const app = express();

app.use(bodyParser.raw({ type: "application/json" }));

app.post(
  "/",
  wrapAsync(async (req, res) => {
    const sig = req.headers["stripe-signature"] as string;

    try {
      const evt = stripe.webhooks.constructEvent(
        req.body,
        sig,
        config.stripe.webhookSecret
      );

      log.info(`Got webhook ${evt.id} ${evt.type}`);

      switch (evt.type) {
        case "checkout.session.completed":
          await handleCheckoutSessionCompleted(
            evt.data.object as Stripe.Checkout.Session
          );
          break;

        case "invoice.paid":
          await handleInvoicePaid(evt.data.object as Stripe.Invoice);
          break;
      }
    } catch (err: any) {
      log.error(`Got webhook error: ${err.message}`, err);
      return res.status(400).send(`Webhook error: ${err.message}`);
    }

    res.sendStatus(200);
  })
);

async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session
) {
  await GiftService.completeGiftFlow(session.id);
}

async function handleInvoicePaid(invoice: Stripe.Invoice) {
  if (invoice.billing_reason === "subscription_create") {
    const paymentIntent = await stripe.paymentIntents.retrieve(
      invoice.payment_intent as string
    );
    const subscription = await stripe.subscriptions.update(
      invoice.subscription as string,
      {
        default_payment_method: paymentIntent.payment_method as string
      }
    );
  }
}

export default app;

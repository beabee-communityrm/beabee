import bodyParser from "body-parser";
import express from "express";
import Stripe from "stripe";

import { log as mainLogger } from "@core/logging";
import stripe from "@core/lib/stripe";
import { wrapAsync } from "@core/utils";

import GiftService from "@core/services/GiftService";

import config from "@config";

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
        config.stripe.webhook_secret
      );

      log.info(
        {
          action: "got-webhook",
          data: {
            id: evt.id,
            type: evt.type
          }
        },
        `Got webhook ${evt.id} ${evt.type}`
      );

      if (evt.type === "checkout.session.completed") {
        await handleCheckoutSessionCompleted(
          evt.data.object as Stripe.Checkout.Session
        );
      }
    } catch (err) {
      log.error(
        {
          action: "error",
          error: err
        },
        `Got webhook error: ${err.message}`
      );
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

export default app;

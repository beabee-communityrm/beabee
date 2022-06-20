import bodyParser from "body-parser";
import express from "express";
import Stripe from "stripe";
import { getRepository } from "typeorm";

import { log as mainLogger } from "@core/logging";
import stripe from "@core/lib/stripe";
import { wrapAsync } from "@core/utils";
import { convertStatus } from "@core/utils/payment/stripe";

import EmailService from "@core/services/EmailService";
import GiftService from "@core/services/GiftService";
import MembersService from "@core/services/MembersService";
import PaymentService from "@core/services/PaymentService";

import Payment, { PaymentStatus } from "@models/Payment";

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
        config.stripe.webhookSecret
      );

      log.info(`Got webhook ${evt.id} ${evt.type}`);

      switch (evt.type) {
        case "checkout.session.completed":
          await handleCheckoutSessionCompleted(
            evt.data.object as Stripe.Checkout.Session
          );
          break;

        case "customer.subscription.updated":
          await handleCustomerSubscriptionUpdated(
            evt.data.object as Stripe.Subscription
          );
          break;

        case "customer.subscription.deleted":
          await handleCustomerSubscriptionDeleted(
            evt.data.object as Stripe.Subscription
          );
          break;

        case "invoice.created":
        case "invoice.updated":
          await handleInvoiceUpdated(evt.data.object as Stripe.Invoice);
          break;

        case "invoice.paid":
          await handleInvoicePaid(evt.data.object as Stripe.Invoice);
          break;

        case "payment_method.detached":
          await handlePaymentMethodDetached(
            evt.data.object as Stripe.PaymentMethod
          );
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

// Checks if the subscription has become incomplete_expired, this means that the
// subscription never properly started (e.g. initial payment failed) so we
// should revoke their membership
async function handleCustomerSubscriptionUpdated(
  subscription: Stripe.Subscription
) {
  if (subscription.status === "incomplete_expired") {
    const data = await PaymentService.getDataBy(
      "subscriptionId",
      subscription.id
    );
    if (data) {
      log.info(
        `Subscription ${subscription.id} never started, revoking membership from ${data.member.id}`
      );
      await MembersService.revokeMemberPermission(data.member, "member");
      await PaymentService.updateDataBy(data.member, "subscriptionId", null);
    }
  }
}

// The subscription has been cancelled, send the user a cancellation email
async function handleCustomerSubscriptionDeleted(
  subscription: Stripe.Subscription
) {
  log.info("Cancel subscription " + subscription.id);
  const data = await PaymentService.getDataBy(
    "subscriptionId",
    subscription.id
  );
  if (data) {
    await MembersService.cancelMemberContribution(data.member);
    await EmailService.sendTemplateToMember(
      "cancelled-contribution",
      data.member
    );
  }
}

// Invoice created or updated, update our equivalent entry in the Payment table
async function handleInvoiceUpdated(invoice: Stripe.Invoice) {
  if (!invoice.customer) {
    log.info("Ignoring invoice without customer " + invoice.id);
    return;
  }

  const data = await PaymentService.getDataBy(
    "customerId",
    invoice.customer as string
  );
  if (!data) {
    log.info("Ignoring invoice with unknown customer " + invoice.customer);
    return;
  }

  let payment = await getRepository(Payment).findOne(invoice.id);

  if (!payment) {
    payment = new Payment();
    payment.id = invoice.id;

    log.info(
      `Creating payment for ${data.member.id} with invoice ${invoice.id}`
    );
    payment.member = data.member;
    payment.subscriptionId = invoice.subscription as string | null;
  }

  log.info("Updating payment for invoice " + invoice.id);

  payment.status = invoice.status
    ? convertStatus(invoice.status)
    : PaymentStatus.Pending;
  payment.description = invoice.description || "";
  payment.amount = invoice.total / 100;
  payment.chargeDate = new Date(invoice.created * 1000);

  await getRepository(Payment).save(payment);
}

// Invoice has been paid, if this is related to a subscription then extend the
// user's membership to the new end of the subscription
async function handleInvoicePaid(invoice: Stripe.Invoice) {
  if (!invoice.customer || !invoice.subscription) {
    return;
  }

  const data = await PaymentService.getDataBy(
    "customerId",
    invoice.customer as string
  );
  if (!data) {
    return;
  }

  const subscription = await stripe.subscriptions.retrieve(
    invoice.subscription as string
  );

  await MembersService.extendMemberPermission(
    data.member,
    "member",
    new Date(subscription.current_period_end * 1000)
  );

  // TODO: handle nextMonthlyAmount
}

// Payment method has been detached, remove any reference to it in our system
async function handlePaymentMethodDetached(
  paymentMethod: Stripe.PaymentMethod
) {
  const data = await PaymentService.getDataBy("mandateId", paymentMethod.id);
  if (data) {
    log.info("Detached payment method " + paymentMethod.id, {
      mandateId: paymentMethod.id,
      memberId: data.member.id
    });
    await PaymentService.updateDataBy(data.member, "mandateId", null);
  }
}

export default app;

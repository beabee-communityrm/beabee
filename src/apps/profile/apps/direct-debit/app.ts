import express, { NextFunction, Request, Response } from "express";

import { hasSchema, isLoggedIn } from "@core/middleware";
import {
  ContributionPeriod,
  ContributionType,
  hasUser,
  PaymentForm,
  RequestWithUser,
  wrapAsync
} from "@core/utils";

import config from "@config";

import EmailService from "@core/services/EmailService";
import GCPaymentService from "@core/services/GCPaymentService";
import JoinFlowService from "@core/services/JoinFlowService";
import OptionsService from "@core/services/OptionsService";
import PollsService from "@core/services/PollsService";

import { completeFlowSchema, updateSubscriptionSchema } from "./schemas.json";

interface UpdateSubscriptionSchema {
  amount: number;
  payFee: boolean;
  period: ContributionPeriod;
  prorate: boolean;
  useMandate: boolean;
}

const app = express();

app.set("views", __dirname + "/views");

app.use(isLoggedIn);

app.use(
  wrapAsync(async (req, res, next) => {
    res.locals.gcData = await GCPaymentService.getPaymentData(req.user!);
    next();
  })
);

function hasSubscription(req: Request, res: Response, next: NextFunction) {
  if (res.locals.gcData?.subscriptionId) {
    next();
  } else {
    req.flash("danger", "contribution-doesnt-exist");
    res.redirect("/profile/direct-debit");
  }
}

app.get(
  "/",
  wrapAsync(
    hasUser(async function (req, res) {
      res.render("index", {
        user: req.user,
        hasPendingPayment: await GCPaymentService.hasPendingPayment(req.user),
        bankAccount: await GCPaymentService.getContributionInfo(req.user),
        canChange: await GCPaymentService.canChangeContribution(
          req.user,
          !!res.locals.gcData?.mandateId
        )
      });
    })
  )
);

function schemaToPaymentForm(data: UpdateSubscriptionSchema): {
  useMandate: boolean;
  paymentForm: PaymentForm;
} {
  return {
    useMandate: !!data.useMandate,
    paymentForm: {
      monthlyAmount: data.amount,
      period: data.period,
      payFee: !!data.payFee,
      prorate: data.prorate
    }
  };
}

async function handleChangeContribution(
  req: RequestWithUser,
  form: PaymentForm
) {
  const wasGift = req.user.contributionType === ContributionType.Gift;
  await GCPaymentService.updateContribution(req.user, form);
  if (wasGift) {
    await EmailService.sendTemplateToMember("welcome-post-gift", req.user);
    req.flash("success", "contribution-gift-updated");
  } else {
    req.flash("success", "contribution-updated");
  }
}

app.post(
  "/",
  [hasSchema(updateSubscriptionSchema).orFlash],
  wrapAsync(
    hasUser(async (req, res) => {
      const { useMandate, paymentForm } = schemaToPaymentForm(req.body);

      let redirectUrl = "/profile/direct-debit";

      if (await GCPaymentService.canChangeContribution(req.user, useMandate)) {
        if (useMandate) {
          await handleChangeContribution(req, paymentForm);
        } else {
          const completeUrl =
            config.audience + "/profile/direct-debit/complete";
          redirectUrl = await JoinFlowService.createJoinFlow(
            completeUrl,
            {
              ...paymentForm,
              // TODO: we don't need to store these here, they won't be used
              email: req.user.email,
              password: req.user.password
            },
            req.user
          );
        }
      } else {
        req.flash("warning", "contribution-updating-not-allowed");
      }

      res.redirect(redirectUrl);
    })
  )
);

app.get(
  "/complete",
  [hasSchema(completeFlowSchema).orRedirect("/profile")],
  wrapAsync(
    hasUser(async (req, res) => {
      if (await GCPaymentService.canChangeContribution(req.user, false)) {
        const joinFlow = await JoinFlowService.getJoinFlow(
          req.query.redirect_flow_id as string
        );
        if (joinFlow) {
          const { customerId, mandateId } =
            await JoinFlowService.completeJoinFlow(joinFlow);
          await GCPaymentService.updatePaymentMethod(
            req.user,
            customerId,
            mandateId
          );
          await handleChangeContribution(req, joinFlow.joinForm);
        } else {
          req.flash("warning", "contribution-updating-failed");
        }
      } else {
        req.flash("warning", "contribution-updating-not-allowed");
      }

      res.redirect("/profile/direct-debit");
    })
  )
);

async function getCancellationPoll() {
  const pollId = OptionsService.getText("cancellation-poll");
  return pollId ? await PollsService.getPoll(pollId) : undefined;
}

app.get(
  "/cancel-subscription",
  hasSubscription,
  wrapAsync(async (req, res) => {
    res.render("cancel-subscription", {
      cancellationPoll: await getCancellationPoll()
    });
  })
);

app.post(
  "/cancel-subscription",
  hasSubscription,
  wrapAsync(
    hasUser(async (req, res) => {
      const cancellationPoll = await getCancellationPoll();
      if (cancellationPoll && req.body.data) {
        await PollsService.setResponse(
          cancellationPoll,
          req.user,
          req.body.data
        );
      }

      await GCPaymentService.cancelContribution(req.user);
      await EmailService.sendTemplateToMember(
        "cancelled-contribution-no-survey",
        req.user
      );

      req.flash("success", "contribution-cancelled");

      res.redirect("/profile/direct-debit");
    })
  )
);

export default app;

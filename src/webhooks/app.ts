import "module-alias/register";

import express, { Handler } from "express";

import { log, requestErrorLogger, requestLogger } from "@core/logging";
import { initApp, startServer } from "@core/server";

import OptionsService, { OptionKey } from "@core/services/OptionsService";

import gocardlessApp from "./handlers/gocardless";
import mailchimpApp from "./handlers/mailchimp";
import stripeApp from "./handlers/stripe";

function checkOpt(key: OptionKey): Handler {
  return (req, res, next) => {
    if (OptionsService.getBool(key)) {
      next();
    } else {
      next("router");
    }
  };
}

const app = express();

app.use(requestLogger);

app.get("/ping", function (req, res) {
  res.sendStatus(200);
});

app.use("/gc", checkOpt("switch-webhook-gc"), gocardlessApp);
app.use("/mailchimp", checkOpt("switch-webhook-mailchimp"), mailchimpApp);
app.use("/stripe", checkOpt("switch-webhook-stripe"), stripeApp);

app.use(requestErrorLogger);

initApp()
  .then(() => startServer(app))
  .catch((err) => {
    log.error("Error during initialization", err);
  });

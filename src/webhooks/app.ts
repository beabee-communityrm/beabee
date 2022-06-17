import "module-alias/register";

import express, { Handler } from "express";

import * as db from "@core/database";
import { requestErrorLogger, requestLogger } from "@core/logging";
import startServer from "@core/server";

import OptionsService, { OptionKey } from "@core/services/OptionsService";

import gocardlessApp from "./gocardless";
import mailchimpApp from "./mailchimp";
import stripeApp from "./stripe";

function checkOpt(key: OptionKey): Handler {
  return (req, res, next) => {
    if (OptionsService.getBool(key)) {
      next();
    } else {
      next("route");
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

db.connect().then(() => startServer(app));

import "module-alias/register";

import express from "express";

import * as db from "@core/database";
import { requestErrorLogger, requestLogger } from "@core/logging";
import startServer from "@core/server";

import gocardlessApp from "./handlers/gocardless";
import mailchimpApp from "./handlers/mailchimp";
import stripeApp from "./handlers/stripe";

const app = express();

app.use(requestLogger);

app.get("/ping", function (req, res) {
  res.sendStatus(200);
});

app.use("/gc", gocardlessApp);
app.use("/mailchimp", mailchimpApp);
app.use("/stripe", stripeApp);

app.use(requestErrorLogger);

db.connect().then(() => startServer(app));

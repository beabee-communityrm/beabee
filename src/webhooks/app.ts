import "module-alias/register";

import express from "express";

import * as db from "@core/database";
import { log, requestErrorLogger, requestLogger } from "@core/logging";
import { wrapAsync } from "@core/utils";

import OptionsService from "@core/services/OptionsService";

import gocardlessApp from "./gocardless";
import mailchimpApp from "./mailchimp";
import stripeApp from "./stripe";

const app = express();

app.use(requestLogger);

app.get("/ping", function (req, res) {
  log.info("Got ping");
  res.sendStatus(200);
});

app.use("/gc", gocardlessApp);
app.use("/mailchimp", mailchimpApp);
app.use("/stripe", stripeApp);

app.use(requestErrorLogger);

const internalApp = express();

internalApp.post(
  "/reload",
  wrapAsync(async (req, res) => {
    await OptionsService.reload();
    res.sendStatus(200);
  })
);

db.connect().then(async () => {
  log.info("Starting server...");

  const server = app.listen(3000);
  const internalServer = internalApp.listen(4000);

  process.on("SIGTERM", () => {
    log.info("Waiting for server to shutdown");
    db.close();

    setTimeout(() => {
      log.warn("Server was forced to shutdown after timeout");
      process.exit(1);
    }, 20000).unref();

    server.close(() => process.exit());
    internalServer.close();
  });
});

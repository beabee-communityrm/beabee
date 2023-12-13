import express, { Express } from "express";

import * as db from "@core/database";
import { log as mainLogger } from "@core/logging";
import { wrapAsync } from "@core/utils";

import OptionsService from "@core/services/OptionsService";

const log = mainLogger.child({ app: "server" });

const internalApp = express();

internalApp.post(
  "/reload",
  wrapAsync(async (req, res) => {
    await OptionsService.reload();
    res.sendStatus(200);
  })
);

export async function initApp() {
  log.info("Initializing app...");
  await db.connect();
  await OptionsService.reload();
}

export function startServer(app: Express) {
  log.info("Starting server...");

  app.set("trust proxy", true);

  const server = app.listen(3000);
  const internalServer = internalApp.listen(4000);

  process.on("SIGTERM", () => {
    log.debug("Waiting for server to shutdown");
    internalServer.close();
    server.close();
    db.close();

    setTimeout(() => {
      log.warn("Server was forced to shutdown after timeout");
      process.exit(1);
    }, 20000).unref();
  });
}

export async function runApp(fn: () => Promise<void>) {
  try {
    await initApp();
    await fn();
  } catch (err) {
    log.error("Uncaught error", err);
  }
  await db.close();
}

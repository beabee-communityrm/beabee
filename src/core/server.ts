import express, { Express } from "express";

import { close as closeDb } from "@core/database";
import { log as mainLogger } from "@core/logging";
import { wrapAsync } from "@core/utils";

import OptionsService from "@core/services/OptionsService";

const log = mainLogger.child({ app: "server" });

export default function startServer(app: Express) {
  log.info("Starting server...");

  app.set("trust proxy", true);

  const internalApp = express();

  internalApp.post(
    "/reload",
    wrapAsync(async (req, res) => {
      await OptionsService.reload();
      res.sendStatus(200);
    })
  );

  const server = app.listen(3000);
  const internalServer = internalApp.listen(4000);

  process.on("SIGTERM", () => {
    log.debug("Waiting for server to shutdown");
    closeDb();

    internalServer.close();
    server.close(() => process.exit());

    setTimeout(() => {
      log.warn("Server was forced to shutdown after timeout");
      process.exit(1);
    }, 20000).unref();
  });
}

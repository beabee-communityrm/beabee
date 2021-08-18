import "reflect-metadata";

import { createConnection, getConnection } from "typeorm";

import { log } from "@core/logging";

import OptionsService from "@core/services/OptionsService";

export async function connect(): Promise<void> {
  try {
    await createConnection();
    log.debug("Connected to database");
    await OptionsService.reload();
  } catch (error) {
    log.error("Error connecting to database", error);
    process.exit(1);
  }
}

export async function close(): Promise<void> {
  await getConnection().close();
}

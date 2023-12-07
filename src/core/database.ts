import "reflect-metadata";

import { DataSource, EntityTarget, ObjectLiteral, Repository } from "typeorm";

import { log as mainLogger } from "@core/logging";

import OptionsService from "@core/services/OptionsService";
import config from "@config";

const log = mainLogger.child({ app: "database" });

export let dataSource: DataSource;
export function getRepository<Entity extends ObjectLiteral>(
  target: EntityTarget<Entity>
): Repository<Entity> {
  return dataSource.getRepository(target);
}

export function getConnection(): DataSource {
  return dataSource;
}

export async function connect(): Promise<void> {
  try {
    dataSource = new DataSource({
      type: "postgres",
      url: config.databaseUrl
    });
    await dataSource.initialize();
    log.info("Connected to database");
    await OptionsService.reload();
  } catch (error) {
    log.error("Error connecting to database", error);
    process.exit(1);
  }
}

export async function close(): Promise<void> {
  await dataSource.destroy();
}

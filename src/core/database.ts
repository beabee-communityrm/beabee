import "reflect-metadata";

import {
  DataSource,
  EntityTarget,
  ObjectLiteral,
  QueryRunner,
  Repository,
  SelectQueryBuilder
} from "typeorm";

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

export function createQueryBuilder<Entity extends ObjectLiteral>(
  entityClass: EntityTarget<Entity>,
  alias: string,
  queryRunner?: QueryRunner
): SelectQueryBuilder<Entity>;
export function createQueryBuilder(
  queryRunner?: QueryRunner
): SelectQueryBuilder<any>;
export function createQueryBuilder<Entity extends ObjectLiteral>(
  arg1?: EntityTarget<Entity> | QueryRunner,
  alias?: string,
  queryRunner?: QueryRunner
): SelectQueryBuilder<Entity> {
  if (alias) {
    return dataSource.createQueryBuilder(
      arg1 as EntityTarget<Entity>,
      alias,
      queryRunner
    );
  } else {
    return dataSource.createQueryBuilder(arg1 as QueryRunner);
  }
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

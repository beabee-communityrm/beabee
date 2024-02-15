import {
  EntityTarget,
  ObjectLiteral,
  OrderByCondition,
  SelectQueryBuilder
} from "typeorm";
import { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";

import { createQueryBuilder, getRepository } from "@core/database";
import { log as mainLogger } from "@core/logging";

import Callout from "@models/Callout";
import CalloutResponse from "@models/CalloutResponse";
import {
  CalloutComponentSchema,
  CalloutResponseAnswersSlide
} from "@beabee/beabee-common";

import {
  calloutResponsesAnonymiser,
  createComponentAnonymiser,
  ModelAnonymiser,
  ObjectMap,
  PropertyMap
} from "./models";

const log = mainLogger.child({ app: "anonymisers" });

// Maps don't stringify well
function stringify(value: any): string {
  return JSON.stringify(value, (key: string, value: any): any => {
    return value instanceof Map ? [...value] : value;
  });
}

function anonymiseItem<T>(
  item: T,
  objectMap: ObjectMap<T>,
  valueMap?: Map<string, unknown>,
  copyProps = true
): T {
  const newItem = copyProps ? Object.assign({}, item) : ({} as T);

  for (const prop in objectMap) {
    const propertyMap = objectMap[prop] as PropertyMap<unknown>;
    const oldValue = item[prop];
    if (oldValue && propertyMap) {
      const valueKey = stringify(oldValue);

      const newValue =
        typeof propertyMap === "function"
          ? valueMap?.get(valueKey) || propertyMap(oldValue)
          : anonymiseItem(oldValue, propertyMap, valueMap);

      newItem[prop] = newValue;

      if (valueMap) {
        valueMap.set(valueKey, newValue);
      }
    }
  }

  return newItem;
}

function writeItems<T extends ObjectLiteral>(
  model: EntityTarget<T>,
  items: T[]
) {
  const [query, params] = createQueryBuilder()
    .insert()
    .into(model)
    .values(items as QueryDeepPartialEntity<T>)
    .getQueryAndParameters();

  console.log(query + ";");
  console.log(stringify(params));
}

function createAnswersMap(
  components: CalloutComponentSchema[]
): ObjectMap<CalloutResponseAnswersSlide> {
  // return Object.fromEntries(
  //   components.map((c) => [c.key, createComponentAnonymiser(c)])
  // );
  return {};
}

async function anonymiseCalloutResponses(
  fn: (
    qb: SelectQueryBuilder<CalloutResponse>
  ) => SelectQueryBuilder<CalloutResponse>,
  valueMap: Map<string, unknown>
): Promise<void> {
  const callouts = await createQueryBuilder(Callout, "callout").getMany();
  for (const callout of callouts) {
    const answersMap = createAnswersMap(
      [] // TODO
    );

    const responses = await fn(createQueryBuilder(CalloutResponse, "item"))
      .andWhere("item.callout = :callout", { callout: callout.slug })
      .orderBy("item.id", "ASC")
      .getMany();

    if (responses.length === 0) {
      continue;
    }

    log.info("-- " + callout.slug);

    const newResponses = responses.map((response) => {
      const newResponse = anonymiseItem(
        response,
        calloutResponsesAnonymiser.objectMap,
        valueMap
      );
      newResponse.answers = anonymiseItem(
        response.answers,
        answersMap,
        undefined,
        false
      );
      return newResponse;
    });

    writeItems(CalloutResponse, newResponses);
  }
}

export async function anonymiseModel<T extends ObjectLiteral>(
  anonymiser: ModelAnonymiser<T>,
  fn: (qb: SelectQueryBuilder<T>) => SelectQueryBuilder<T>,
  valueMap: Map<string, unknown>
): Promise<void> {
  const metadata = getRepository(anonymiser.model).metadata;
  log.info(`Anonymising ${metadata.tableName}`);

  // Callout responses are handled separately
  if (anonymiser === calloutResponsesAnonymiser) {
    return await anonymiseCalloutResponses(fn as any, valueMap);
  }

  // Order by primary keys for predictable pagination
  const orderBy: OrderByCondition = Object.fromEntries(
    metadata.primaryColumns.map((col) => ["item." + col.databaseName, "ASC"])
  );

  for (let i = 0; ; i += 1000) {
    const items = await fn(createQueryBuilder(anonymiser.model, "item"))
      .orderBy(orderBy)
      .offset(i)
      .limit(1000)
      .getMany();

    if (items.length === 0) {
      break;
    }

    const newItems = items.map((item) =>
      anonymiseItem(item, anonymiser.objectMap, valueMap)
    );

    writeItems(anonymiser.model, newItems);
  }
}

export function clearModels(anonymisers: ModelAnonymiser<ObjectLiteral>[]) {
  // Reverse order to clear foreign keys correctly
  for (let i = anonymisers.length - 1; i >= 0; i--) {
    console.log(
      `DELETE FROM "${getRepository(anonymisers[i].model).metadata.tableName}";`
    );
    console.log(); // Empty params line
  }
}

import 'module-alias/register';

import { ConnectionOptions, createQueryBuilder, getRepository } from 'typeorm';

import * as db from '@core/database';

import config from '@config';

import driers, { Drier, DrierMap } from './driers';

// Anonymise properties but maintain same mapping to keep links
const valueMap = new Map<string, unknown>();

function isDrier<T>(propMap: DrierMap<T>[keyof T]): propMap is Drier<T[keyof T]> {
	return 'propMap' in propMap;
}

// Maps don't stringify well
function replacer(key: string, value: any): any {
	return value instanceof Map ? [...value] : value;
}

function runDrier<T>(item: T, drier: Drier<T>): T {
	const newItem = Object.assign({}, item);

	for (const _prop of Object.keys(drier.propMap)) {
		const prop = _prop as keyof T;
		const propMap = drier.propMap[prop];
		const oldValue = item[prop];
		if (oldValue && propMap) {
			const valueKey = JSON.stringify(oldValue, replacer);

			const newValue = isDrier(propMap) ? runDrier(oldValue, propMap) :
				valueMap.get(valueKey) || propMap(oldValue);

			valueMap.set(valueKey, newValue);
			newItem[prop] = newValue as T[keyof T];
		}
	}

	return newItem;
}

async function runExport<T>(drier: Drier<T>): Promise<void> {
	console.error(`Anonymising ${getRepository(drier.model).metadata.tableName}`);

	for (let i = 0; ; i += 1000) {
		const items = await createQueryBuilder(drier.model)
			.loadAllRelationIds().offset(i).limit(1000).getMany();

		if (items.length === 0) {
			break;
		}

		const newItems = items.map(item => runDrier(item, drier));

		const [query, params] = createQueryBuilder()
			.insert().into(drier.model).values(newItems).getQueryAndParameters();

		console.log(query + ';');
		console.log(JSON.stringify(params, replacer));
	}
}

async function main() {
	for (const drier of driers.slice().reverse()) {
		console.log(`DELETE FROM "${getRepository(drier.model).metadata.tableName}";`);
		console.log();
	}
	for (const drier of driers) {
		await runExport(drier);
	}
}

db.connect(config.mongo, config.db as ConnectionOptions).then(async () => {
	try {
		await main();
	} catch (err) {
		console.error(err);
	}
	await db.close();
});

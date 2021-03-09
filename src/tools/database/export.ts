import 'module-alias/register';

import { EJSON } from 'bson';

import config from '@config';
import * as db from '@core/database';
import newExportTypes, { Drier, DrierMap, NewModelData } from './newTypes';
import { ConnectionOptions, getRepository } from 'typeorm';

// Anonymise properties but maintain same mapping to keep links
const valueMap = new Map<string, unknown>();

function isDrier<T>(propMap: DrierMap<T>[WritableKeysOf<T>]): propMap is Drier<T[WritableKeysOf<T>]> {
	return 'propMap' in propMap;
}

function runDrier<T>(item: T, drier: Drier<T>): T {
	const newItem = Object.assign({}, item);

	for (const _prop of Object.keys(drier.propMap)) {
		const prop = _prop as WritableKeysOf<T>;
		const propMap = drier.propMap[prop];
		const oldValue = item[prop];
		if (oldValue && propMap) {
			// Serialize Maps correctly
			const mapKey = oldValue instanceof Map ?
				Array.from(oldValue.entries()).toString() : oldValue + '';

			let newValue = isDrier(propMap) ? runDrier(oldValue, propMap) :
				valueMap.get(mapKey) || propMap(oldValue);

			if (newValue instanceof Map) {
				newValue = Array.from(newValue.entries());
			}

			valueMap.set(mapKey, newValue);
			newItem[prop] = newValue as T[WritableKeysOf<T>];
		}
	}

	return newItem;
}

async function runNewExport<T>(drier: Drier<T>): Promise<NewModelData<T>> {
	console.error('Fetching new', drier.modelName);
	const items = await getRepository(drier.model).find({loadRelationIds: true});

	console.error(`Anonymising ${drier.modelName}, got ${items.length} items`);
	const newItems = items.map(item => runDrier(item, drier));
	return {items: newItems, modelName: drier.modelName};
}

async function main() {
	const newExportData: NewModelData<any>[] = [];
	for (const newExportType of newExportTypes) {
		newExportData.push(await runNewExport(newExportType));
	}

	console.log(EJSON.stringify({newExportData}));
}

db.connect(config.mongo, config.db as ConnectionOptions).then(async () => {
	try {
		await main();
	} catch (err) {
		console.error(err);
	}
	await db.close();
});

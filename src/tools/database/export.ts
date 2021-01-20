import 'module-alias/register';

import { serialize, deserialize, Document, EJSON } from 'bson';
import _ from 'lodash';

import config from '@config';
import * as db from '@core/database';
import exportTypes, { ModelData, ModelExporter, Properties } from './types';
import newExportTypes, { Drier, DrierMap, NewModelData } from './newTypes';
import { ConnectionOptions, getRepository } from 'typeorm';

// Anonymise properties but maintain same mapping to keep links
const valueMap = new Map<string, unknown>();

function anonymiseProperties(item: Document, properties: Properties): Document {
	const newItem = deserialize(serialize(item));

	_.forEach(properties, (anonymiseFn, property) => {
		const value = _.get(item, property);
		if (value) {
			let newValue: unknown;
			if (_.isArray(value)) {
				newValue = value.map(valueItem => anonymiseProperties(valueItem, anonymiseFn() as Properties));
			} else {
				newValue = valueMap.get(value.toString()) || anonymiseFn();
				valueMap.set(value.toString(), newValue);
			}
			_.set(newItem, property, newValue);
		}
	});

	return newItem;
}

async function runExport({model, properties}: ModelExporter): Promise<ModelData> {
	console.error('Fetching', model.modelName);

	const items = await model.find({}).lean();

	console.error(`Anonymising ${model.modelName}, got ${items.length} items`);
	const newItems = properties ? items.map(item => anonymiseProperties(item, properties)) : items;

	return {
		modelName: model.modelName,
		items: newItems
	};
}

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
	const items = await getRepository(drier.model).find();

	console.error(`Anonymising ${drier.modelName}, got ${items.length} items`);
	const newItems = items.map(item => runDrier(item, drier));
	return {items: newItems, modelName: drier.modelName};
}

async function main() {
	const exportData = await Promise.all(exportTypes.map(runExport));
	const newExportData = await Promise.all(newExportTypes.map(runNewExport));
	console.log(EJSON.stringify({exportData, newExportData}));
}

db.connect(config.mongo, config.db as ConnectionOptions).then(async () => {
	try {
		await main();
	} catch (err) {
		console.error(err);
	}
	await db.close();
});

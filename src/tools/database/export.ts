import 'module-alias/register';

import { serialize, deserialize, Document, EJSON } from 'bson';
import _ from 'lodash';

import config from '@config';
import * as db from '@core/database';
import exportTypes, { ModelData, ModelExporter, Properties } from './types';
import newExportTypes, { Drier, Mapping, NewModelData, WritableKeysOf } from './newTypes';
import { ConnectionOptions, getRepository } from 'typeorm';

// Anonymise properties but maintain same mapping to keep links
const valueMap = new Map<unknown, unknown>();

function anonymiseProperties(item: Document, properties: Properties): Document {
	const newItem = deserialize(serialize(item));

	_.forEach(properties, (anonymiseFn, property) => {
		const value = _.get(item, property);
		if (value) {
			let newValue: unknown;
			if (_.isArray(value)) {
				newValue = value.map(valueItem => anonymiseProperties(valueItem, anonymiseFn() as Properties));
			} else {
				newValue = valueMap.get(value) || anonymiseFn();
				valueMap.set(value, newValue);
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

function isDrier<T>(propMap: Mapping<T>[WritableKeysOf<T>]): propMap is Drier<T[WritableKeysOf<T>]> {
	return 'itemMap' in propMap;
}

function runDrier<T>(item: T, drier: Drier<T>): T {
	if (drier.itemMap) {
		const newItem = Object.assign({}, item);
		for (const property of Object.keys(drier.itemMap)) {
			const prop = property as WritableKeysOf<T>;
			const propMap = drier.itemMap[prop];
			if (isDrier(propMap)) {
				newItem[prop] = runDrier(item[prop], propMap);
			} else if (propMap) {
				newItem[prop] = propMap();
			}
		}
		return newItem;
	} else {
		return item;
	}
}

async function runNewExport<T>(drier: Drier<T>): Promise<NewModelData<T>> {
	const items = await getRepository(drier.model).find();
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

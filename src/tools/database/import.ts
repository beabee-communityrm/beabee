import 'module-alias/register';

import _ from 'lodash';
import { EJSON, ObjectId } from 'bson';
import fs from 'fs';

import config from '@config';
import * as db from '@core/database';

import importTypes, { ModelData } from './types';
import newImportTypes, { NewModelData } from './newTypes';
import { ConnectionOptions, EntityTarget, getRepository } from 'typeorm';

const importsByName = _.fromPairs(importTypes.map((importType) => [importType.model.modelName, importType]));

const newModelsByName = new Map(newImportTypes.map(t => [t.modelName, t.model]));

async function runImport({modelName, items}: ModelData): Promise<void> {
	console.error(`Importing ${modelName}, got ${items.length} items`);
	const {model, objectIds} = importsByName[modelName];
	const itemsWithIds = items.map(item => Object.assign({}, item,
		...objectIds ? objectIds.map(oid => ({[oid]: new ObjectId(item[oid])})) : []
	));
	try {
		await model.deleteMany({});
		await model.collection.insertMany(itemsWithIds);
		console.error(`Finished importing ${modelName}`);
	} catch (err) {
		console.error(`Error importing ${modelName}`);
		console.error(err);
	}
}

async function runNewImport<T>({modelName, items}: NewModelData<T>): Promise<void> {
	console.error(`Importing new ${modelName}, got ${items.length} items`);
	const model = newModelsByName.get(modelName) as EntityTarget<T>;
	if (model) {
		try {
			const repository = getRepository(model);
			await repository.delete({});
			for (let i = 0; i < items.length; i += 1000) {
				const slice = items.slice(i, i + 1000);
				await repository.insert(slice);
			}
			console.error(`Finished importing ${modelName}`);
		} catch (err) {
			console.error(`Error importing ${modelName}`);
			console.error(err);
		}
	}
}

if (!config.dev) {
	console.error('Can\'t import to live database');
	process.exit(1);
}

db.connect(config.mongo, config.db as ConnectionOptions).then(async () => {
	try {
		const data = EJSON.parse(fs.readFileSync(process.argv[2]).toString()) as {
			exportData: ModelData[]
			newExportData: NewModelData<any>[]
		};
		await Promise.all(data.exportData.map(runImport));
		await Promise.all(data.newExportData.map(runNewImport));
	} catch (err) {
		console.log(err);
	}

	await db.close();
});

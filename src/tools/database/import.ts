import 'module-alias/register';

import _ from 'lodash';
import { EJSON } from 'bson';
import fs from 'fs';

import config from '@config';
import * as db from '@core/database';

import importTypes, { ModelData } from './types';
import newImportTypes, { NewModelData } from './newTypes';
import { EntityTarget, getRepository } from 'typeorm';

const modelsByName = _.fromPairs(importTypes.map(({model}) => [model.modelName, model]));

const newModelsByName = new Map(newImportTypes.map(t => [t.modelName, t.model]));

async function runImport({modelName, items}: ModelData): Promise<void> {
	console.error(`Importing ${modelName}, got ${items.length} items`);
	const model = modelsByName[modelName];
	await model.deleteMany({});
	try {
		await model.collection.insertMany(items);
	} catch (err) {
		console.error(err);
	}
}

async function runNewImport<T>({modelName, items}: NewModelData<T>): Promise<void> {
	console.error(`Importing new ${modelName}, got ${items.length} items`);
	const model = newModelsByName.get(modelName) as EntityTarget<T>;
	if (model) {
		const repository = getRepository(model);
		await repository.delete({});
		await repository.insert(items);
	}
}

if (!config.dev) {
	console.error('Can\'t import to live database');
	process.exit(1);
}

db.connect(config.mongo).then(async () => {
	try {
		const data = EJSON.parse(fs.readFileSync(process.argv[2]).toString()) as {
			importData: ModelData[]
			newImportData: NewModelData<any>[]
		};
		await Promise.all(data.importData.map(runImport));
		await Promise.all(data.newImportData.map(runNewImport));
	} catch (err) {
		console.log(err);
	}

	await db.close();
});

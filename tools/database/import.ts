import 'module-alias/register';

import _ from 'lodash';
import { EJSON } from 'bson';
import fs from 'fs';

import config from '@config';
import db from '@core/database';

import importTypes, { ModelData } from './types';

const modelsByName = _.fromPairs(importTypes.map(({model}) => [model.modelName, model]));

async function runImport({modelName, items}: ModelData) {
	console.error(`Importing ${modelName}, got ${items.length} items`);
	const model = modelsByName[modelName];
	await model.deleteMany({});
	try {
		await model.collection.insertMany(items);
	} catch (err) {
		console.error(err);
	}
}

async function main(importData) {
	await Promise.all(importData.map(runImport));
}

if (!config.dev) {
	console.error('Can\'t import to live database');
	process.exit(1);
}

db.connect(config.mongo);

db.mongoose.connection.on('connected', async () => {
	try {
		const data = EJSON.parse(fs.readFileSync(process.argv[2]).toString());
		await main(data);
	} catch (err) {
		console.log(err);
	}

	db.mongoose.disconnect();
});

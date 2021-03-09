import 'module-alias/register';

import { EJSON } from 'bson';
import fs from 'fs';

import config from '@config';
import * as db from '@core/database';

import newImportTypes, { NewModelData } from './newTypes';
import { ConnectionOptions, EntityTarget, getRepository } from 'typeorm';

const newModelsByName = new Map(newImportTypes.map(t => [t.modelName, t.model]));

async function runNewImport<T>({modelName, items}: NewModelData<T>): Promise<void> {
	console.error(`Importing new ${modelName}, got ${items.length} items`);
	const model = newModelsByName.get(modelName) as EntityTarget<T>;
	if (model) {
		try {
			const repository = getRepository(model);
			for (let i = 0; i < items.length; i += 1000) {
				const slice = items.slice(i, i + 1000);
				await repository.insert(slice);
			}
			console.error(`Finished importing ${modelName}`);
		} catch (err) {
			console.error(`Error importing ${modelName}`);
			console.error(items);
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
			newExportData: NewModelData<any>[]
		};

		// Delete before in reverse order for foreign key constraints
		for (const {modelName} of data.newExportData.slice().reverse()) {
			const model = newModelsByName.get(modelName);
			model && await getRepository(model).delete({});
		}

		for (const newModelData of data.newExportData) {
			await runNewImport(newModelData);
		}
	} catch (err) {
		console.log(err);
	}

	await db.close();
});

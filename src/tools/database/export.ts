import 'module-alias/register';

import { ConnectionOptions, getRepository } from 'typeorm';

import * as db from '@core/database';

import config from '@config';

import allDriers, { runExport } from './driers';

async function main() {
	for (const drier of allDriers.slice().reverse()) {
		console.log(`DELETE FROM "${getRepository(drier.model).metadata.tableName}";`);
		console.log();
	}
	const valueMap = new Map<string, unknown>();
	for (const drier of allDriers) {
		await runExport(drier, qb => qb, valueMap);
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

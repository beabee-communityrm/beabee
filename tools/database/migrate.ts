import 'module-alias/register';

import _ from 'lodash';
import mongoose from 'mongoose';
import { ConnectionOptions, EntityTarget, getRepository } from 'typeorm';

import config from '@config';

import * as db from '@core/database';

import PageSettings from '@models/PageSettings';

interface Migration<T> {
	model: EntityTarget<T>,
	collection: string,
	mapping: Record<string, keyof T>
}

// Use this to get type checking on mapping
function createMigration<T>(model: EntityTarget<T>, collection: string, mapping: Record<string, keyof T>): Migration<T> {
	return { model, collection, mapping };
}

const migrations: Migration<any>[] = [
	createMigration(PageSettings, 'pagesettings', {
		pattern: 'pattern',
		shareUrl: 'shareUrl',
		shareTitle: 'shareTitle',
		shareDescription: 'shareDescription',
		shareImage: 'shareImage',
	})
];

db.connect(config.mongo, config.db as ConnectionOptions).then(async () => {
	const mdb = mongoose.connection.db;

	for (const migration of migrations) {
		console.log('Migrating ' + migration.collection);
		const repo = getRepository(migration.model);
		const collection = mdb.collection(migration.collection);
		const cursor = collection.find();
		while (await cursor.hasNext()) {
			process.stdout.write('.');
			const doc = await cursor.next();
			const item = _(migration.mapping).map((v, k) => [v, doc[k]]).fromPairs().valueOf();
			await repo.save(item);
		}
		console.log();
	}

	await db.close();
});

import 'module-alias/register';

import mongoose, { Document } from 'mongoose';
import { ConnectionOptions, EntityTarget, getRepository } from 'typeorm';

import config from '@config';

import * as db from '@core/database';

import PageSettings from '@models/PageSettings';
import Payment from '@models/Payment';

type IfEquals<X, Y, A, B> =
    (<T>() => T extends X ? 1 : 2) extends
	(<T>() => T extends Y ? 1 : 2) ? A : B;

type WritableKeysOf<T> = {
    [P in keyof T]: IfEquals<{ [Q in P]: T[P] }, { -readonly [Q in P]: T[P] }, P, never>
}[keyof T];

type Mapping<T> = Record<Exclude<WritableKeysOf<T>,'id'>, (doc: Document) => any>;


interface Migration<T> {
	model: EntityTarget<T>,
	collection: string,
	mapping: Mapping<T>
}

// Use this to get type checking on mapping
function createMigration<T>(model: EntityTarget<T>, collection: string, mapping: Mapping<T>): Migration<T> {
	return { model, collection, mapping };
}

function copy(field: string) {
	return (doc: Document) => doc[field];
}

function objectId(field: string) {
	return (doc: Document) => doc[field] ? doc[field].toString() : null;
}

const migrations: Migration<any>[] = [
	createMigration(PageSettings, 'pagesettings', {
		pattern: copy('pattern'),
		shareUrl: copy('shareUrl'),
		shareTitle: copy('shareTitle'),
		shareDescription: copy('shareDescription'),
		shareImage: copy('shareImage')
	}),
	createMigration(Payment, 'payments', {
		paymentId: copy('payment_id'),
		subscriptionId: copy('subscription_id'),
		subscriptionPeriod: copy('subscription_period'),
		memberId: objectId('member'),
		status: copy('status'),
		description: copy('description'),
		amount: copy('amount'),
		amountRefunded: copy('amount_refunded'),
		createdAt: copy('created'),
		chargeDate: copy('charge_date'),
		updatedAt: copy('updated_at')
	})
];

db.connect(config.mongo, config.db as ConnectionOptions).then(async () => {
	const mdb = mongoose.connection.db;

	for (const migration of migrations) {
		let items = [];
		console.log('Migrating ' + migration.collection);
		const repo = getRepository(migration.model);
		const collection = mdb.collection(migration.collection);
		const cursor = collection.find();
		while (await cursor.hasNext()) {
			process.stdout.write('.');
			const doc = await cursor.next();
			const item = {};
			for (const key in migration.mapping) {
				item[key] = migration.mapping[key](doc);
			}
			items.push(item);
			if (items.length === 1000) {
				await repo.insert(items);
				items = [];
			}
		}
		if (items.length > 0) {
			await repo.insert(items);
		}
		console.log();
	}

	await db.close();
});

import 'module-alias/register';

import _ from 'lodash';
import mongoose from 'mongoose';
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

type Mapping<T> = Record<WritableKeysOf<Exclude<keyof T,'id'>>, string>;


interface Migration<T> {
	model: EntityTarget<T>,
	collection: string,
	mapping: Mapping<T>
}

// Use this to get type checking on mapping
function createMigration<T>(model: EntityTarget<T>, collection: string, mapping: Mapping<T>): Migration<T> {
	return { model, collection, mapping };
}

const migrations: Migration<any>[] = [
	createMigration(PageSettings, 'pagesettings', {
		pattern: 'pattern',
		shareUrl: 'shareUrl',
		shareTitle: 'shareTitle',
		shareDescription: 'shareDescription',
		shareImage: 'shareImage',
	}),
	createMigration(Payment, 'payments', {
		paymentId: 'payment_id',
		subscriptionId: 'subscription_id',
		subscriptionPeriod: 'subscription_period',
		memberId: 'member_id',
		status: 'status',
		description: 'description',
		amount: 'amount',
		amountRefunded: 'amount_refunded',
		createdAt: 'created',
		chargeDate: 'charge_date',
		updatedAt: 'updated_at'
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
			const item = _(migration.mapping).map((v, k) => [k, doc[v as string]]).fromPairs().valueOf();
			await repo.save(item);
		}
		console.log();
	}

	await db.close();
});

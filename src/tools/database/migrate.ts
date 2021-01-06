import 'module-alias/register';

import { Document } from 'bson';
import mongoose  from 'mongoose';
import { ConnectionOptions, EntityTarget, getRepository } from 'typeorm';

import config from '@config';

import * as db from '@core/database';

import PageSettings from '@models/PageSettings';
import Payment from '@models/Payment';
import Option from '@models/Option';
import GiftFlow, { GiftForm } from '@models/GiftFlow';

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
	return (doc: Document)=> doc[field];
}

function objectId(field: string) {
	return (doc: Document) => doc[field] ? doc[field].toString() : null;
}

function ident<T extends readonly string[]>(fields: T): {[key in T[number]]: any} {
	return Object.assign(
		{},
		...fields.map(field => ({[field]: copy(field)}))
	);
}

const migrations: Migration<any>[] = [
	createMigration(PageSettings, 'pagesettings', {
		...ident(['pattern', 'shareUrl', 'shareTitle', 'shareDescription', 'shareImage'] as const),
	}),
	createMigration(Payment, 'payments', {
		...ident(['status', 'description', 'amount'] as const),
		paymentId: copy('payment_id'),
		subscriptionId: copy('subscription_id'),
		subscriptionPeriod: copy('subscription_period'),
		memberId: objectId('member'),
		amountRefunded: copy('amount_refunded'),
		createdAt: copy('created'),
		chargeDate: copy('charge_date'),
		updatedAt: copy('updated_at')
	}),
	createMigration(Option, 'options', {
		...ident(['key', 'value'] as const)
	}),
	createMigration(GiftFlow, 'giftflows', {
		...ident(['sessionId', 'setupCode', 'date', 'completed', 'processed'] as const),
		giftForm: doc => {
			const giftForm = new GiftForm();
			giftForm.firstname = doc.giftForm.firstname;
			giftForm.lastname = doc.giftForm.lastname;
			giftForm.email = doc.giftForm.email;
			giftForm.startDate = doc.giftForm.startDate;
			giftForm.fromName = doc.giftForm.fromName;
			giftForm.fromEmail = doc.giftForm.fromEmail;
			giftForm.message = doc.giftForm.message;
			giftForm.months = Number(doc.giftForm.type);
			if (doc.giftForm.delivery_address) {
				giftForm.giftAddress = doc.giftForm.delivery_address;
			}
			if (doc.giftForm.delivery_copies_address) {
				giftForm.deliveryAddress = doc.giftForm.delivery_copies_address;
			}
			return giftForm;
	})
];

db.connect(config.mongo, config.db as ConnectionOptions).then(async () => {
	const mdb = mongoose.connection.db;

	for (const migration of migrations) {
		let items: Document[] = [];
		console.log('Migrating ' + migration.collection);
		const repo = getRepository(migration.model);
		const collection = mdb.collection(migration.collection);
		const cursor = collection.find();
		while (await cursor.hasNext()) {
			process.stdout.write('.');
			const doc = await cursor.next();
			const item: Document = {};
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

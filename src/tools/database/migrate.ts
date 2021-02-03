import 'module-alias/register';

import { Document } from 'bson';
import mongoose from 'mongoose';
import { ConnectionOptions, EntityManager, EntityTarget, getConnection, ObjectLiteral } from 'typeorm';

import config from '@config';

import * as db from '@core/database';

import PageSettings from '@models/PageSettings';
import Payment from '@models/Payment';
import Option from '@models/Option';
import GCPaymentData from '@models/GCPaymentData';
import GiftFlow, { GiftForm } from '@models/GiftFlow';
import ReferralGift from '@models/ReferralGift';
import Referral from '@models/Referral';
import Export from '@models/Export';
import ExportItem from '@models/ExportItem';
import Poll from '@models/Poll';
import PollResponse from '@models/PollResponse';

type Mapping<T> = {[K in Exclude<WritableKeysOf<T>,'id'>]: (subdoc: Document, doc: Document) => T[K]};

interface Migration<T> {
	model: EntityTarget<T>,
	collection: string,
	docExpand: (doc: Document) => Document[]
	itemMap: Mapping<T>
}

// Use this to get type checking on mapping
function createMigration<T>(
	model: EntityTarget<T>,
	collection: string,
	itemMap: Mapping<T>,
	docExpand = (doc: Document) => [doc]
): Migration<T> {
	return { model, collection, docExpand, itemMap };
}

function copy(field: string) {
	return (doc: Document) => doc[field];
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

const newItemMap: Map<string, ObjectLiteral> = new Map();

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
		}
	}),
	createMigration(ReferralGift, 'referralgifts', {
		...ident(['name', 'label', 'description', 'minAmount', 'enabled', 'options'] as const),
		stock: doc => new Map(doc.stock && Object.entries(doc.stock))
	}),
	createMigration(Referral, 'referrals', {
		...ident(['date', 'refereeAmount', 'refereeGiftOptions', 'referrerGiftOptions'] as const),
		refereeId: objectId('referee'),
		referrerId: objectId('referrer'),
		refereeGift: doc => doc.refereeGift ? {name: doc.refereeGift} as ReferralGift : undefined,
		referrerGift: doc => doc.referrerGift ? {name: doc.referrerGift} as ReferralGift : undefined,
		referrerHasSelected: doc => doc.referrerGift !== undefined
	}),
	createMigration(Export, 'exports', {
		...ident(['type', 'description', 'date', 'params'] as const)
	}),
	/*createMigration(ExportItem, 'members', {
		export: doc => newItemMap.get(doc.export_id.toString()) as Export,
		itemId: (subdoc, doc) => doc._id.toString(),
		status: subdoc => subdoc.status
	}, doc => doc.exports),
	createMigration(ExportItem, 'pollanswers', {
		export: doc => newItemMap.get(doc.export_id.toString()) as Export,
		itemId: (subdoc, doc) => doc._id.toString(),
		status: subdoc => subdoc.status
	}, doc => doc.exports || []),*/
	createMigration(Poll, 'polls', {
		...ident(['slug', 'date', 'closed', 'starts', 'expires', 'pollMergeField'] as const),
		title: copy('question'),
		allowUpdate: doc => !!doc.allowUpdate,
		mcMergeField: copy('mergeField'),
		template: copy('formTemplate'),
		templateSchema: doc => {
			if (doc.formTemplate === 'ballot') {
				return {
					...doc.formSchema,
					intro: doc.intro,
					thanksTitle: doc.thanksTitle,
					thanksText: doc.thanksText
				};
			} else if (doc.formTemplate === 'builder') {
				return {
					formSchema: doc.formSchema,
					intro: doc.intro,
					thanksTitle: doc.thanksTitle,
					thanksText: doc.thanksText
				};
			} else {
				return {};
			}
		},
		public: () => false
	}),
	createMigration(PollResponse, 'pollanswers', {
		...ident(['answers', 'createdAt', 'updatedAt'] as const),
		poll: doc => newItemMap.get(doc.poll.toString()) as Poll,
		memberId: objectId('member'),
		isPartial: doc => !!doc.isPartial,
		guestName: () => undefined,
		guestEmail: () => undefined
	}),
	createMigration(GCPaymentData, 'members', {
		memberId: doc => doc._id,
		customerId: doc => doc.gocardless && doc.gocardless.customer_id,
		mandateId: doc => doc.gocardless && doc.gocardless.mandate_id,
		subscriptionId: doc => doc.gocardless && doc.gocardless.subscription_id,
		cancelledAt: doc => doc.gocardless && doc.gocardless.cancelled_at,
		payFee: doc => doc.gocardless && doc.gocardless.paying_fee
	})
];

const doMigration = (migration: Migration<any>) => async (manager: EntityManager) => {

	async function* getItems() {
		let items: {oldId: string, item: Document}[] = [];
		const collection = mongoose.connection.db.collection(migration.collection);
		const cursor = collection.find();

		while (await cursor.hasNext()) {
			process.stdout.write('.');
			const doc = await cursor.next() as Document;

			for (const subdoc of migration.docExpand(doc)) {
				const item: Document = {};
				for (const key in migration.itemMap) {
					item[key] = migration.itemMap[key](subdoc, doc);
				}
				items.push({oldId: subdoc._id.toString(), item});
			}

			if (items.length >= 1000) {
				yield items;
				items = [];
			}
		}

		if (items.length > 0) {
			yield items;
		}
	}

	for await (const items of getItems()) {
		console.log(items.length);
		const insert = await manager.insert(migration.model, items.map(i => i.item));
		insert.identifiers.forEach((newItem, i) => {
			newItemMap.set(items[i].oldId, newItem);
		});
	}
};

db.connect(config.mongo, config.db as ConnectionOptions).then(async () => {
	try {
		for (const migration of migrations) {
			console.log('Migrating ' + migration.collection);
			await getConnection().transaction(doMigration(migration));
			console.log();
		}
	} catch (err) {
		console.error(err);
	}

	await db.close();
});

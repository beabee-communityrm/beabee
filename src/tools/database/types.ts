import Chance from 'chance';
import crypto from 'crypto';
import mongoose, { Document as MDocument, Model } from 'mongoose';
import { Document } from 'bson';

import * as db from '@core/database';

export interface Properties {
	[key: string]: () => unknown
}

export interface ModelExporter {
	model: Model<MDocument>
	properties?: Properties,
	objectIds?: string[]
}

export interface ModelData {
	modelName: string,
	items: Document[]
}

const chance = new Chance();

// TODO: anonymise dates

let codeNo = 0;
function uniqueCode(): string {
	codeNo++;
	const letter = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(codeNo / 1000)];
	const no = codeNo % 1000;
	return letter.padStart(2, 'A') + (no + '').padStart(3, '0');
}

const objectId = () => new mongoose.Types.ObjectId().toString();

const members: Properties = {
	_id: objectId,
	uuid: () => chance.guid({version: 4}),
	email: () => chance.email({domain: 'example.com', length: 10}),
	firstname: () => chance.first(),
	lastname: () => chance.last(),
	otp: () => ({}),
	password: () => ({}),
	pollsCode: uniqueCode,
	referralCode: uniqueCode,
	join_reason: () => chance.sentence(),
	join_why: () => chance.sentence(),
	description: () => chance.sentence(),
	bio: () => chance.paragraph(),
	notes: () => chance.sentence(),
	'contact.telephone': () => chance.phone(),
	'contact.twitter': () => chance.twitter(),
	'delivery_address.line1': () => chance.address(),
	'delivery_address.line2': () => chance.pickone(['Cabot', 'Easton', 'Southmead', 'Hanham']),
	'delivery_address.city': () => 'Bristol',
	'delivery_address.postcode': () => 'BS1 1AA',
	'cancellation.satisfied': () => chance.integer({min: 0, max: 5}),
	'cancellation.reason': () => chance.sentence(),
	'cancellation.other': () => chance.sentence(),
	'billing_location.latitude': () => chance.latitude(),
	'billing_location.longitude': () => chance.longitude(),
	tags: (): Properties => ({
		name: () => chance.profession()
	})
};

const models: ModelExporter[] = [
	{ model: db.Permissions as unknown as Model<MDocument> },
	{ model: db.Members as unknown as Model<MDocument>, properties: members, objectIds: ['_id'] }
];

export default models;

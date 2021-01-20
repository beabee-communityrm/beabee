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

function randomId(len: number) {
	return crypto.randomBytes(6).toString('hex').slice(0, len).toUpperCase();
}

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
	email: () => chance.email(),
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
	'gocardless.customer_id': () => 'CU' + randomId(12),
	'gocardless.mandate_id': () => 'MA' + randomId(12),
	'gocardless.subscription_id': () => 'SB' + randomId(12),
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

const pollAnswers: Properties = {
	_id: objectId,
	member: objectId
};

const projects: Properties = {
	owner: objectId
};

const projectMembers: Properties = {
	_id: objectId,
	member: objectId,
	tag: () => chance.word(),
	engagement: (): Properties => ({
		member: objectId,
		notes: () => chance.sentence()
	})
};

const models: ModelExporter[] = [
	{ model: db.Permissions as unknown as Model<MDocument> },
	{ model: db.Members as unknown as Model<MDocument>, properties: members, objectIds: ['_id'] },
	{ model: db.Polls },
	{ model: db.PollAnswers, properties: pollAnswers, objectIds: ['_id', 'member'] },
	{ model: db.Projects , properties: projects, objectIds: ['owner'] },
	{ model: db.ProjectMembers, properties: projectMembers, objectIds: ['_id', 'member'] }
];

export default models;

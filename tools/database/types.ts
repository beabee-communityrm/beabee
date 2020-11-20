import Chance from 'chance';
import crypto from 'crypto';
import mongoose, { Document as MDocument, Model } from 'mongoose';
import { Document } from 'bson';

import db from '@core/database';

export interface Properties {
	[key: string]: () => unknown
}

export interface ModelExporter {
    model: Model<MDocument>
    properties?: Properties
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

const payments: Properties = {
	_id: () => new mongoose.Types.ObjectId(),
	payment_id: () => 'PM' + randomId(12),
	subscription_id: () => 'SB' + randomId(12),
	member: () => new mongoose.Types.ObjectId()
};

const members: Properties = {
	_id: () => new mongoose.Types.ObjectId(),
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
	bio: () => chance.sentence(),
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
		name: () => chance.word()
	})
};

const referrals: Properties = {
	_id: () => new mongoose.Types.ObjectId(),
	referrer: () => new mongoose.Types.ObjectId(),
	referee: () => new mongoose.Types.ObjectId()
};

const pollAnswers: Properties = {
	_id: () => new mongoose.Types.ObjectId(),
	member: () => new mongoose.Types.ObjectId()
};

const projects: Properties = {
	owner: () => new mongoose.Types.ObjectId()
};

const projectMembers: Properties = {
	_id: () => new mongoose.Types.ObjectId(),
	member: () => new mongoose.Types.ObjectId(),
	tag: () => chance.word()
};

const models: ModelExporter[] = [
	{ model: db.Exports },
	{ model: db.Options },
	{ model: db.Permissions },
	{ model: db.Payments, properties: payments },
	{ model: db.Members, properties: members },
	{ model: db.ReferralGifts },
	{ model: db.Referrals, properties: referrals },
	{ model: db.Notices },
	{ model: db.Polls },
	{ model: db.PollAnswers, properties: pollAnswers },
	{ model: db.Projects , properties: projects },
	{ model: db.ProjectMembers, properties: projectMembers }
];

export default models;

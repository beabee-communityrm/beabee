const Chance = require('chance');
const crypto = require('crypto');
const mongoose = require('mongoose');

const db = require( __js + '/database' );

const chance = new Chance();

// TODO: anonymise dates

function randomId(len) {
	return crypto.randomBytes(6).toString('hex').slice(0, len).toUpperCase();
}

let codeNo = 0;
function uniqueCode() {
	codeNo++;
	const letter = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(codeNo / 1000)];
	const no = codeNo % 1000;
	return letter.padStart(2, 'A') + (no + '').padStart(3, '0');
}

const payments = {
	_id: () => new mongoose.Types.ObjectId(),
	payment_id: () => 'PM' + randomId(12),
	subscription_id: () => 'SB' + randomId(12),
	member: () => new mongoose.Types.ObjectId()
};

const members = {
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
	'delivery_address.line2': () => chance.pickone(['Cabot', 'Easton', 'Southmead']),
	'delivery_address.city': () => 'Bristol',
	'delivery_address.postcode': () => 'BS1 1AA',
	'cancellation.satisfied': () => chance.integer({min: 0, max: 5}),
	'cancellation.reason': () => chance.sentence(),
	'cancellation.other': () => chance.sentence(),
	'billing_location.latitude': () => chance.latitude(),
	'billing_location.longitude': () => chance.longitude(),
};

const referrals = {
	_id: () => new mongoose.Types.ObjectId(),
	referrer: () => new mongoose.Types.ObjectId(),
	referee: () => new mongoose.Types.ObjectId()
};

const pollAnswers = {
	_id: () => new mongoose.Types.ObjectId(),
	member: () => new mongoose.Types.ObjectId()
};

const projects = {
	owner: () => new mongoose.Types.ObjectId()
};

const projectMembers = {
	_id: () => new mongoose.Types.ObjectId(),
	member: () => new mongoose.Types.ObjectId(),
	tag: () => chance.word()
};

module.exports = [
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

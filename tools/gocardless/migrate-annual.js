require('module-alias/register');

global.__root = __dirname + '/../..';
global.__apps = __root + '/apps';
global.__config = __root + '/config/config.json';
global.__js = __root + '/src/js';
global.__models = __root + '/src/models';

const axios = require( 'axios' );
const fs = require( 'fs' );
const moment = require( 'moment' );
const Papa = require( 'papaparse' );

const config = require( __config );
const db = require( __js + '/database' );
const { default: gocardless } = require( '@core/gocardless' );
const mandrill = require(__js + '/mandrill');

const { getSpecialUrlUrl } = require( __apps + '/tools/apps/special-urls/utils' );

const DRY_RUN = process.argv[2] === '-n';
const DATE = process.argv[DRY_RUN ? 3 : 2];
const FILENAME = process.argv[DRY_RUN ? 4 : 3];

class OptOutError extends Error {}

async function getMember(subscriptionId) {
	const member = await db.Members.findOne({
		'gocardless.subscription_id' : subscriptionId,
	});

	if (!member) {
		throw new Error('Not found');
	}
	if (!member.isActiveMember) {
		throw new Error('Not active');
	}
	if (member.contributionMonthlyAmount !== 1) {
		throw new Error('Not contributing £1');
	}
	if (member.contributionPeriod !== 'monthly') {
		throw new Error('Not monthly');
	}
	if (member.gocardless.paying_fee) {
		throw new Error('Is paying the fee');
	}
	if (member.tags.filter(t => t.name === 'OPTOUT1').length > 0) {
		throw new OptOutError();
	}

	return member;
}

async function sendReminder(subscriptionId) {
	const member = await getMember(subscriptionId);

	console.log('Reminding ' + subscriptionId);
	console.log('  ' + member.email);

	const optOutUrl = await db.SpecialUrls.create( {
		email: member.email,
		group: '5e394cc9403a6961f225f82a',
		firstname: member.firstname,
		lastname: member.lastname,
		expires: moment.utc().add(48, 'hours')
	} );

	if (!DRY_RUN) {
		await mandrill.sendToMember('gocardless-email-mo-to-an-feb-2020', member, {
			url: getSpecialUrlUrl(optOutUrl)
		});
	}
}

async function migrateToAnnual(subscriptionId) {
	const member = await getMember(subscriptionId);
	const subscription = await gocardless.subscriptions.get(subscriptionId);

	const payments = await gocardless.payments.all({
		subscription: subscriptionId,
		'charge_date[gte]': DATE
	});

	if (payments.length > 0) {
		throw new Error('Has future payments');
	}

	console.log('Migrating ' + subscriptionId);
	console.log('  ' + member.email + ', ' + subscription.upcoming_payments[0].charge_date);

	if (!DRY_RUN) {
		// Unset first to stop cancelled email on webhook
		await member.update({$unset: {'gocardless.subscription_id': 1}});

		await gocardless.subscriptions.cancel(subscriptionId);

		const newSubscription = await gocardless.subscriptions.create({
			amount: 1200,
			currency: 'GBP',
			name: 'Membership',
			interval_unit: 'yearly',
			start_date: subscription.upcoming_payments[0].charge_date,
			links: {
				mandate: subscription.links.mandate
			}
		});

		await member.update( { $set: {
			'gocardless.period': 'annually',
			'gocardless.subscription_id': newSubscription.id
		} } );
	}
}

async function main() {
	const blah = Papa.parse(fs.readFileSync(FILENAME).toString(), {header: true});

	let reminders = 0, migrations = 0, errors = 0, optouts = 0;
	for (const row of blah.data) {
		const days = moment.utc(DATE).diff(row.charge_date, 'days');
		try {
			if (days === -10) {
				await migrateToAnnual(row.subscription_id);
				migrations++;
			} else if (days === -12) {
				await sendReminder(row.subscription_id);
				reminders++;
			}
		} catch (err) {
			console.error('ERROR: Problem with ' + row.subscription_id);
			if (err instanceof OptOutError) {
				console.error('ERROR: Opted out');
				optouts++;
			} else {
				console.error(err);
				errors++;
			}
		}
	}

	console.error(`INFO: Reminded ${reminders} and migrated ${migrations}`);
	console.error(`INFO: Got ${optouts} opt outs and ${errors} errors`);

	await axios.post(config.migrateSlack.url, {
		'text': `Reminded ${reminders} and migrated ${migrations}. Got ${optouts} opt outs and ${errors} errors`
	});
}

db.connect(config.mongo);

db.mongoose.connection.on('connected', () => {
	main()
		.catch(err => console.error(err))
		.then(() => db.mongoose.disconnect());
});

global.__root = __dirname + '/../..';
global.__apps = __root + '/apps';
global.__config = __root + '/config/config.json';
global.__js = __root + '/src/js';
global.__models = __root + '/src/models';

const fs = require( 'fs' );
const moment = require( 'moment' );
const Papa = require( 'papaparse' );

const config = require( __config );
const db = require( __js + '/database' );
const gocardless = require(__js + '/gocardless');
const mandrill = require(__js + '/mandrill');

const DRY_RUN = process.argv[2] === '-n';
const DATE = process.argv[DRY_RUN ? 3 : 2];
const FILENAME = process.argv[DRY_RUN ? 4 : 3];

if (!DRY_RUN) {
	console.log('NOT A DRY RUN');
	process.exit(1);
}

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
		throw new Error('Has opted out');
	}

	return member;
}

async function sendReminder(subscriptionId) {
	const member = await getMember(subscriptionId);
	if (DRY_RUN) {
		console.log('Would remind ' + subscriptionId);
		console.log('  ' + member.email);
	} else {
		return true; // TODO
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

	if (DRY_RUN) {
		console.log('Would migrate ' + subscriptionId);
		console.log('  ' + member.email + ', ' + subscription.upcoming_payments[0].charge_date);
	} else {
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

	for (const row of blah.data) {
		const days = moment.utc(DATE).diff(row.charge_date, 'days');
		try {
			if (days === -10) {
				await migrateToAnnual(row.subscription_id);
			} else if (days === -12) {
				await sendReminder(row.subscription_id);
			}
		} catch (err) {
			console.error('ERROR: Problem with ' + row.subscription_id);
			console.error(err);
		}
	}

}

db.connect(config.mongo);

db.mongoose.connection.on('connected', () => {
	main()
		.catch(err => console.error(err))
		.then(() => db.mongoose.disconnect());
});

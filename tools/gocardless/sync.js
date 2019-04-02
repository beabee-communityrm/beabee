global.__root = __dirname + '/../..';
global.__apps = __root + '/apps';
global.__config = __root + '/config/config.json';
global.__js = __root + '/src/js';
global.__models = __root + '/src/models';

const fs = require('fs');
const _ = require('lodash');
const moment = require('moment');

const config = require(__config);
const db = require(__js + '/database').connect(config.mongo);

const utils = require('./sync-utils.js');
const { keyBy } = require('../utils');
const { createPayment, getSubscriptionPeriod } = require('../../webhook-utils.js');

function checkAndLogUpdates(doc, updates) {
	let hasUpdates = _(updates)
		.toPairs()
		.map(([key, value]) => {
			if (_.isEqual(doc[key], value)) {
				return false;
			} else {
				console.log(`Updating ${key}: ${doc[key]} -> ${value}`);
				return true;
			}
		})
		.some();

	return hasUpdates;
}

async function loadData(file) {
	console.log( '# Loading data from file...' );
	const data = JSON.parse(fs.readFileSync(file));

	console.log(`Got ${data.customers.length} customers`);
	console.log(`Got ${data.mandates.length} mandates`);
	console.log(`Got ${data.subscriptions.length} subscriptions`);
	console.log(`Got ${data.payments.length} payments`);
	console.log(`Got ${data.subscriptionCancelledEvents.length} subscription cancelled events`);

	return utils.mergeData(data);
}

function processCustomers(customers) {
	console.log('# Checking which records should be synced...');
	const validCustomers = utils.filterCustomers(customers);
	console.log(`Got ${validCustomers.length} valid customers`);
	return validCustomers;
}

async function syncCustomers(dryRun, validCustomers) {
	console.log('# Syncing with database');

	const permission = await db.Permissions.findOne({slug: 'member'});
	const members = await db.Members.find({permissions: {$elemMatch: {permission}}});

	console.log(`Loaded ${members.length} members`);

	const membersByCustomerId = keyBy(members, m => m.gocardless.customer_id);

	if (!dryRun) {
		await db.Payments.deleteMany({});
	}

	let created = 0, updated = 0, payments = [];

	for (let customer of validCustomers) {
		try {
			let member = membersByCustomerId[customer.id];
			const membershipInfo = utils.getMembershipInfo(customer);

			const gocardless = {
				amount: membershipInfo.amount,
				period: membershipInfo.period,
				customer_id: customer.id,
				...customer.latestActiveMandate && {mandate_id: customer.latestActiveMandate.id},
				...customer.latestActiveSubscription && {subscription_id: customer.latestActiveSubscription.id},
				...membershipInfo.cancelledAt && {cancelled_at: membershipInfo.cancelledAt.toDate()}
			};

			const expires = membershipInfo.expires.add(config.gracePeriod).toDate();

			if (member) {
				const memberUpdates = {
					gocardless,
					'memberPermission.date_added': membershipInfo.starts.toDate(),
					'memberPermission.date_expires': expires
				};

				if (checkAndLogUpdates(member, memberUpdates)) {
					if (!dryRun) {
						await member.update(memberUpdates);
					}
					updated++;
				}

			} else {
				if (!dryRun) {
					member = await db.Members.create({
						firstname: customer.given_name,
						lastname: customer.family_name,
						email: customer.email,
						joined: moment(customer.created_at).toDate(),
						gocardless,
						permissions: [{
							permission,
							date_added: membershipInfo.starts.toDate(),
							date_expires: expires
						}]
					});
				}
				console.log('Created new member', customer.email);
				created++;
			}

			payments = [...payments, ...customer.payments.map(payment => ({
				...createPayment(payment),
				subscription_period: getSubscriptionPeriod(payment.subscription),
				member: member._id,
			}))];

			delete membersByCustomerId[customer.id];
		} catch (error) {
			console.log(customer.id, error.message);
		}
	}

	console.log('Created', created, 'members');
	console.log('Updated', updated, 'members');

	for (const customerId in membersByCustomerId) {
		const member = membersByCustomerId[customerId];
		console.log(member.email, 'was not updated');
	}

	console.log('Inserting', payments.length, 'payments');
	if (!dryRun) {
		for (let i = 0; i < payments.length; i += 1000) {
			await db.Payments.collection.insertMany(payments.slice(i, i + 1000), {ordered: false});
		}
	}
}

console.log( 'Starting...' );

const dryRun = process.argv[2] === '-n';
const dataFile = process.argv[dryRun ? 3 : 2];

loadData(dataFile)
	.then(processCustomers)
	.then(syncCustomers.bind(null, dryRun))
	.catch(error => {
		console.error(error);
	})
	.then(() => db.mongoose.disconnect());

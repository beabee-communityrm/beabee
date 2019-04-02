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

	let created = 0, updated = 0, ignored = 0, payments = [];

	for (let customer of validCustomers) {
		try {
			let member = membersByCustomerId[customer.id];
			if (!member) {
				console.log('Creating new member', customer.email);
				member = db.Members({
					firstname: customer.given_name,
					lastname: customer.family_name,
					email: customer.email,
					joined: moment(customer.created_at).toDate()
				});
				created++;
			}

			utils.customerToMemberUpdates(customer, config.gracePeriod).forEach(([key, value]) => {
				// Get around accessing virtual properties and having subdocuments
				let oldValue = _.get(member, key);
				if (oldValue.toObject) oldValue = oldValue.toObject();

				if (!_.isEqual(oldValue, value)) {
					console.log('Updating', key);
					console.log(JSON.stringify(oldValue), '->', JSON.stringify(value));

					// Set virtual properties correctly
					const keyParts = key.split('.');
					const obj = _.initial(keyParts).reduce((a, p) => a[p], member);
					obj[_.last(keyParts)] = value;
				}
			});

			if (member.isModified()) {
				console.log('Updating member', member.email);
				console.log();

				if (!dryRun) {
					await member.save();
				}
				updated++;
			} else {
				ignored++;
			}

			payments = [...payments, ...customer.payments.map(payment => ({
				...createPayment(payment),
				subscription_period: getSubscriptionPeriod(payment.subscription),
				member: member._id,
			}))];

			delete membersByCustomerId[customer.id];
		} catch (error) {
			console.log(customer.id, error);
		}
	}

	console.log('Created', created, 'members');
	console.log('Updated', updated, 'members, ignored', ignored);

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

const dryRun = process.argv[2] !== '--danger';
const dataFile = process.argv[dryRun ? 2 : 3];

if (!dryRun) {
	console.log('THIS IS NOT A DRY RUN');
}

loadData(dataFile)
	.then(processCustomers)
	.then(syncCustomers.bind(null, dryRun))
	.catch(error => {
		console.error(error);
	})
	.then(() => db.mongoose.disconnect());

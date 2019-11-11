global.__root = __dirname + '/..';
global.__apps = __root + '/apps';
global.__config = __root + '/config/config.json';
global.__js = __root + '/src/js';
global.__models = __root + '/src/models';

const moment = require('moment');

const db = require( __js + '/database' );
const config = require( __config );

async function logMember(type, query) {
	const member = await db.Members.findOne(query);
	console.log('# ' + type);
	if (member) {
		console.log(member.fullname + ', ' + member.email);
		console.log(config.audience + '/members/' + member.uuid);
	} else {
		console.log('No member found');
	}
	console.log();
}

async function logMemberMonthlyAndAnnual(type, query) {
	await logMember(type + ', monthly', {...query, 'gocardless.period': 'monthly'});
	await logMember(type + ', annual', {...query, 'gocardless.period': 'annually'});
}

async function getFilters() {
	const now = moment.utc();

	const scheduledPayments = await db.Payments.find({status: 'pending_submission'});
	const failedPayments = await db.Payments.find({status: 'failed'});

	const membersWithScheduledPayments = scheduledPayments.map(p => p.member);
	const membersWithFailedPayments = failedPayments.map(p => p.member);

	return {
		isActive: {
			permissions: {$elemMatch: {
				permission: config.permission.memberId,
				date_expires: {$gte: now}
			}}
		},
		isInactive: {
			permissions: {$elemMatch: {
				permission: config.permission.memberId,
				date_expires: {$lte: now}
			}}
		},
		isGift: {
			'gocardless.period': 'gift'
		},
		hasCancelled: {
			'gocardless.cancelled_at': {$exists: true}
		},
		noScheduledPayments: {
			_id: {$nin: membersWithScheduledPayments}
		},
		hasScheduledPayments: {
			_id: {$in: membersWithScheduledPayments}
		},
		noFailedPayments: {
			_id: {$nin: membersWithFailedPayments}
		},
		hasFailedPayments: {
			_id: {$in: membersWithFailedPayments}
		}
	};
}

async function main() {
	const filters = await getFilters();

	await logMemberMonthlyAndAnnual('Active, no scheduled payments', {
		...filters.isActive,
		...filters.noScheduledPayments
	});

	await logMemberMonthlyAndAnnual('Active, has scheduled payments', {
		...filters.isActive,
		...filters.hasScheduledPayments
	});

	await logMemberMonthlyAndAnnual('Inactive due to failed payment', {
		...filters.isInactive,
		...filters.hasFailedPayments
	});

	await logMemberMonthlyAndAnnual('Cancelled active member', {
		...filters.isActive,
		...filters.hasCancelled
	});

	await logMemberMonthlyAndAnnual('Cancelled inactive member', {
		...filters.isInactive,
		...filters.hasCancelled
	});

	await logMember('Active, gift membership', {
		...filters.isActive,
		...filters.isGift
	});

	await logMember('Inactive, gift membership', {
		...filters.isInactive,
		...filters.isGift
	});
}

db.connect(config.mongo);

db.mongoose.connection.on('connected', () => {
	console.log();
	main()
		.catch(err => console.error(err))
		.then(() => db.mongoose.disconnect());
});

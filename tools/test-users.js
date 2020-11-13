require('module-alias/register');

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

async function logMemberVaryContributions(type, query) {
	const amounts = [1, 3, 5];
	for (const amount of amounts) {
		await logMember(`${type}, £${amount}/monthly`, {
			...query,
			'gocardless.amount': amount,
			'gocardless.period': 'monthly'
		});
		await logMember(`${type}, £${amount * 12}/year`, {
			...query,
			'gocardless.amount': amount,
			'gocardless.period': 'annually'
		});
	}
}

async function getFilters() {
	const now = moment.utc();

	const scheduledPayments = await db.Payments.find({status: 'pending_submission'});
	const failedPayments = await db.Payments.find({status: 'failed'});

	const membersWithScheduledPayments = scheduledPayments.map(p => p.member);
	const membersWithFailedPayments = failedPayments.map(p => p.member);

	const permissions = await db.Permissions.find();

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
		isSuperAdmin: {
			permissions: {$elemMatch: {
				permission: permissions.find(p => p.slug === 'superadmin')
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
		},
		isPayingFee: {
			'gocardless.paying_fee': true
		}
	};
}

async function main() {
	const filters = await getFilters();

	await logMemberVaryContributions('Active, no scheduled payments', {
		...filters.isActive,
		...filters.noScheduledPayments
	});

	await logMemberVaryContributions('Active, has scheduled payments', {
		...filters.isActive,
		...filters.hasScheduledPayments
	});

	await logMemberVaryContributions('Inactive due to failed payment', {
		...filters.isInactive,
		...filters.hasFailedPayments
	});

	await logMemberVaryContributions('Cancelled active member', {
		...filters.isActive,
		...filters.hasCancelled
	});

	await logMemberVaryContributions('Cancelled inactive member', {
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

	await logMember('Active, paying fee', {
		...filters.isActive,
		...filters.isPayingFee
	});

	await logMember('Super admin account', {
		$and: [
			filters.isActive,
			filters.isSuperAdmin
		]
	});
}

db.connect(config.mongo);

db.mongoose.connection.on('connected', () => {
	console.log();
	main()
		.catch(err => console.error(err))
		.then(() => db.mongoose.disconnect());
});

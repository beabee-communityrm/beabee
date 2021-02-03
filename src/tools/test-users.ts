import 'module-alias/register';

import moment from 'moment';
import { FilterQuery } from 'mongoose';
import { ConnectionOptions, getRepository } from 'typeorm';

import * as db from '@core/database';

import Payment from '@models/Payment';
import { Member } from '@models/members';

import config from '@config';
import { ContributionPeriod } from '@core/utils';

async function logMember(type: string, query: FilterQuery<Member>) {
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

async function logMemberVaryContributions(type: string, query: FilterQuery<Member>) {
	const amounts = [1, 3, 5];
	for (const amount of amounts) {
		await logMember(`${type}, £${amount}/monthly`, {
			...query,
			contributionMonthlyAmount: amount,
			contributionPeriod: ContributionPeriod.Monthly
		});
		await logMember(`${type}, £${amount * 12}/year`, {
			...query,
			contributionMonthlyAmount: amount,
			contributionPeriod: ContributionPeriod.Annually
		});
	}
}

async function getFilters() {
	const now = moment.utc();

	const scheduledPayments = await getRepository(Payment).find({status: 'pending_submission'});
	const failedPayments = await getRepository(Payment).find({status: 'failed'});

	const membersWithScheduledPayments = scheduledPayments.map(p => p.memberId);
	const membersWithFailedPayments = failedPayments.map(p => p.memberId);

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
			contributionPeriod: ContributionPeriod.Gift
		},
		hasSubscription: {
			'gocardless.subscription_id': {$exists: true}
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
		...filters.hasSubscription,
		...filters.isInactive,
		...filters.hasFailedPayments
	});

	await logMemberVaryContributions('Inactive due to failed payment, has scheduled payments', {
		...filters.hasSubscription,
		...filters.isInactive,
		...filters.hasFailedPayments,
		...filters.hasScheduledPayments
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

db.connect(config.mongo, config.db as ConnectionOptions).then(async () => {
	console.log();
	try {
		await main();
	} catch (err) {
		console.error(err);
	}
	await db.close();
});

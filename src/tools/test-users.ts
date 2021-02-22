import 'module-alias/register';

import moment from 'moment';
import { FilterQuery } from 'mongoose';
import { ConnectionOptions, getRepository, LessThan, MoreThan } from 'typeorm';

import * as db from '@core/database';
import { ContributionPeriod, ContributionType } from '@core/utils';

import config from '@config';

import GCPaymentData from '@models/GCPaymentData';
import Payment from '@models/Payment';
import { Member } from '@models/members';
import MemberPermission from '@models/MemberPermission';

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

	const activeMemberPermissions = await getRepository(MemberPermission).find({
		permission: 'member', dateExpires: MoreThan(new Date())
	});
	const inactiveMemberPermissions = await getRepository(MemberPermission).find({
		permission: 'member', dateExpires: LessThan(new Date())
	});
	const superAdminPermission = await getRepository(MemberPermission).find({permission: 'superadmin'});

	const membersWithScheduledPayments = scheduledPayments.map(p => p.memberId);
	const membersWithFailedPayments = failedPayments.map(p => p.memberId);

	const gcData = await getRepository(GCPaymentData).find();
	const membersWithSubscriptions = gcData.filter(gc => !!gc.subscriptionId).map(gc => gc.memberId);
	const membersWithCancellations = gcData.filter(gc => !!gc.cancelledAt).map(gc => gc.memberId);
	const membersWithPayingFee = gcData.filter(gc => !!gc.payFee).map(gc => gc.memberId);

	return {
		isActive: {
			_id: {$in: activeMemberPermissions.map(m => m.memberId)}
		},
		isInactive: {
			_id: {$in: inactiveMemberPermissions.map(m => m.memberId)}
		},
		isSuperAdmin: {
			_id: {$in: superAdminPermission.map(s => s.memberId)}
		},
		isGift: {
			contributionType: ContributionType.Gift
		},
		hasSubscription: {
			_id: {$in: membersWithSubscriptions}
		},
		hasCancelled: {
			_id: {$in: membersWithCancellations}
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
			_id: {$in: membersWithPayingFee}
		}
	};
}

async function main() {
	const filters = await getFilters();

	await logMemberVaryContributions('Active, no scheduled payments', {
		$and: [filters.isActive, filters.noScheduledPayments]
	});

	await logMemberVaryContributions('Active, has scheduled payments', {
		$and: [filters.isActive, filters.hasScheduledPayments]
	});

	await logMemberVaryContributions('Inactive due to failed payment', {
		$and: [filters.hasSubscription, filters.isInactive, filters.hasFailedPayments]
	});

	await logMemberVaryContributions('Inactive due to failed payment, has scheduled payments', {
		$and: [filters.hasSubscription, filters.isInactive, filters.hasFailedPayments, filters.hasScheduledPayments]
	});
	await logMemberVaryContributions('Cancelled active member', {
		$and: [filters.isActive, filters.hasCancelled]
	});

	await logMemberVaryContributions('Cancelled inactive member', {
		$and: [filters.isInactive, filters.hasCancelled]
	});

	await logMember('Active, gift membership', {
		$and: [filters.isActive, filters.isGift]
	});

	await logMember('Inactive, gift membership', {
		$and: [filters.isInactive, filters.isGift]
	});

	await logMember('Active, paying fee', {
		$and: [filters.isActive, filters.isPayingFee]
	});

	await logMember('Super admin account', {
		$and: [filters.isActive, filters.isSuperAdmin]
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

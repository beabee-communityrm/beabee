import express from 'express';
import { getRepository } from 'typeorm';

import { hasSchema, isSuperAdmin } from '@core/middleware';
import { ContributionPeriod, ContributionType, createDateTime, isDuplicateIndex, wrapAsync } from '@core/utils';

import GCPaymentService from '@core/services/GCPaymentService';
import MembersService from '@core/services/MembersService';

import ManualPaymentData from '@models/ManualPaymentData';
import MemberPermission, { PermissionType } from '@models/MemberPermission';

import { addContactSchema } from './schemas.json';

interface BaseAddContactSchema {
	firstname: string
	lastname: string
	email: string
	permissions?: {
		permission: PermissionType,
		startDate?: string,
		startTime?: string
		expiryDate?: string,
		expiryTime?: string
	}[]
	addAnother?: boolean
}

interface AddManualContactSchema extends BaseAddContactSchema {
	type: ContributionType.Manual
	source?: string
	reference?: string
	amount?: number
	period?: ContributionPeriod
}

interface AddGCContactSchema extends BaseAddContactSchema {
	type: ContributionType.GoCardless
	customerId: string
	mandateId: string
	amount?: number
	period?: ContributionPeriod,
	payFee?: boolean
}

interface AddNoneContactScema extends BaseAddContactSchema {
	type: ContributionType.None
}

type AddContactSchema = AddManualContactSchema|AddGCContactSchema|AddNoneContactScema;

const app = express();

app.set( 'views', __dirname + '/views' );

app.use(isSuperAdmin);

app.get('/', (req, res) => {
	res.render('index');
});

app.post( '/', hasSchema(addContactSchema).orFlash, wrapAsync( async ( req, res ) => {
	const data = req.body as AddContactSchema;

	const permissions = data.permissions?.map(p => getRepository(MemberPermission).create({
		permission: p.permission,
		dateAdded: createDateTime(p.startDate, p.startTime),
		dateExpires: createDateTime(p.expiryDate, p.expiryTime),
	})) || [];
	
	// TODO: option for newsletter subscribe

	let member;
	try {
		member = await MembersService.createMember({
			firstname: data.firstname,
			lastname: data.lastname,
			email: data.email,
			contributionType: data.type,
			permissions
		});

	} catch (error) {
		if (isDuplicateIndex(error, 'email')) {
			req.flash('danger', 'email-duplicate');
			res.redirect('/members/add');
			return;
		} else {
			throw error;
		}
	}

	if (data.type === ContributionType.GoCardless) {
		await GCPaymentService.updatePaymentMethod(member, data.customerId, data.mandateId);
		if (data.amount && data.period) {
			await GCPaymentService.updateContribution(member, {
				amount: data.amount,
				period: data.period,
				payFee: !!data.payFee,
				prorate: false
			});
		}
	} else if (data.type === ContributionType.Manual) {
		const paymentData = getRepository(ManualPaymentData).create({
			member,
			source: data.source || '',
			reference: data.reference || ''
		});
		await getRepository(ManualPaymentData).save(paymentData);
		await MembersService.updateMember(member, {
			contributionPeriod: data.period,
			contributionMonthlyAmount: data.amount
		});
	}

	req.flash('success', 'member-added');
	res.redirect(data.addAnother ? '/members/add' : '/members/' + member.id)
} ) );

export default app;

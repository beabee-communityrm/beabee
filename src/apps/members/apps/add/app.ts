import express from 'express';
import { getRepository } from 'typeorm';

import { isSuperAdmin } from '@core/middleware';
import { ContributionType, createDateTime, wrapAsync } from '@core/utils';

import GCPaymentService from '@core/services/GCPaymentService';
import MembersService from '@core/services/MembersService';
import ManualPaymentData from '@models/ManualPaymentData';
import MemberPermission from '@models/MemberPermission';

const app = express();

app.set( 'views', __dirname + '/views' );

app.use(isSuperAdmin);

app.get('/', (req, res) => {
	res.render('index');
});

app.post( '/', wrapAsync( async ( req, res ) => {
	const membership = req.body.grantMembership ?
		getRepository(MemberPermission).create({
			permission: 'member',
			dateAdded: createDateTime(req.body.membershipStartDate, req.body.membershipStartTime),
			dateExpires: createDateTime(req.body.membershipExpiryDate, req.body.membershipExpiryTime)
		}) : undefined;

	const member = await MembersService.createMember({
		firstname: req.body.firstname,
		lastname: req.body.lastname,
		email: req.body.email,
		contributionType: req.body.type,
		...membership && {permissions: [membership]}
	}, {
		deliveryOptIn: false
	});

	if (req.body.type === ContributionType.GoCardless) {
		await GCPaymentService.updatePaymentMethod(member, req.body.customerId, req.body.mandateId);
	} else if (req.body.type === ContributionType.Manual) {
		const paymentData = getRepository(ManualPaymentData).create({
			member,
			source: req.body.source || '',
			reference: req.body.reference || ''
		});
		await getRepository(ManualPaymentData).save(paymentData);
		await MembersService.updateMember(member, {
			contributionPeriod: req.body.period,
			contributionMonthlyAmount: req.body.amount
		});
	}

	req.flash('success', 'member-added');
	res.redirect(req.body.another ? '/members/add' : '/members/' + member.id)
} ) );

export default app;

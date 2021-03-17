import express from 'express';

import { isSuperAdmin } from '@core/middleware';
import { ContributionType, wrapAsync } from '@core/utils';

import GCPaymentService from '@core/services/GCPaymentService';
import MembersService from '@core/services/MembersService';
import { getRepository, ManyToOne } from 'typeorm';
import ManualPaymentData from '@models/ManualPaymentData';

const app = express();

app.set( 'views', __dirname + '/views' );

app.use(isSuperAdmin);

app.get('/', (req, res) => {
	res.render('index');
});

app.post( '/', wrapAsync( async ( req, res ) => {
	const overrides = req.body.first_name && req.body.last_name ? {
		given_name: req.body.firstname,
		family_name: req.body.lastname,
		email: req.body.email
	} : {};

	let member;
	if (req.body.type === ContributionType.GoCardless) {
		const partialMember = await GCPaymentService.customerToMember(req.body.customerId, overrides);
		if (partialMember) {
			member = await MembersService.createMember(partialMember.member, partialMember.profile);
			await GCPaymentService.updatePaymentMethod(member, req.body.customerId, req.body.mandateId);
		} else {
			req.flash('error', 'member-add-invalid-direct-debit');
		}
	} else {
		member = await MembersService.createMember({
			email: req.body.email,
			firstname: req.body.firstname,
			lastname: req.body.lastname,
			contributionType: req.body.type
		}, {
			deliveryOptIn: false
		});
		if (req.body.type === ContributionType.Manual) {
			const paymentData = getRepository(ManualPaymentData).create({
				member,
				source: req.body.source || '',
				reference: req.body.reference || ''
			});
			await getRepository(ManualPaymentData).save(paymentData);
		}
	}

	if (member) {
		res.redirect( '/members/' + member.id );
	} else {
		res.redirect( '/members/add' );
	}
} ) );

export default app;

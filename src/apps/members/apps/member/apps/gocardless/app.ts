import express from 'express';
import { getRepository } from 'typeorm';

import auth from '@core/authentication';
import { wrapAsync } from '@core/utils';

import GCPaymentService from '@core/services/GCPaymentService';

import GCPaymentData from '@models/GCPaymentData';
import { Member } from '@models/members';

const app = express();

app.set( 'views', __dirname + '/views' );

app.use(auth.isSuperAdmin);

app.use((req, res, next) => {
	if (res.locals.paymentData) {
		next();
	} else {
		req.flash('error', 'gocardless-no-data');
		res.redirect('/members/' + (req.model as Member).uuid);
	}
});

app.get( '/', wrapAsync( async ( req, res ) => {
	const member = req.model as Member;
	res.render( 'index', {
		member: req.model,
		canChange: await GCPaymentService.canChangeContribution( member, true ),
		monthsLeft: member.memberMonthsRemaining
	} );
} ) );

app.post( '/', wrapAsync( async ( req, res ) => {
	const member = req.model as Member;

	switch ( req.body.action ) {
	case 'update-subscription':
		await GCPaymentService.updateContribution(member, {
			amount: Number(req.body.amount),
			period: req.body.period,
			prorate: req.body.prorate === 'true',
			payFee: req.body.payFee === 'true'
		});
		req.flash( 'success', 'contribution-updated' );
		break;

	case 'force-update':
		await member.update({ $set: {
			contributionMonthlyAmount: Number(req.body.amount),
			contributionPeriod: req.body.period
		} });
		await getRepository(GCPaymentData).update(member.id, {
			customerId: req.body.customerId,
			mandateId: req.body.mandateId,
			subscriptionId: req.body.subscriptionId,
			payFee: req.body.payFee === 'true',
		});

		req.flash( 'success', 'gocardless-updated' );
		break;
	}

	res.redirect( req.originalUrl );
} ) );

export default app;

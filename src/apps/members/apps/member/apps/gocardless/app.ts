import express from 'express';

import auth from '@core/authentication';
import { wrapAsync } from '@core/utils';

import PaymentService from '@core/services/PaymentService';

import { Member } from '@models/members';

const app = express();

app.set( 'views', __dirname + '/views' );

app.use(auth.isSuperAdmin);

app.get( '/', wrapAsync( async ( req, res ) => {
	const member = req.model as Member;
	res.render( 'index', {
		member: req.model,
		canChange: await PaymentService.canChangeContribution( member, member.canTakePayment ),
		monthsLeft: PaymentService.getMonthsLeftOnContribution( member )
	} );
} ) );

app.post( '/', wrapAsync( async ( req, res ) => {
	const member = req.model as Member;

	switch ( req.body.action ) {
	case 'update-subscription':
		await PaymentService.updateContribution(member, {
			amount: Number(req.body.amount),
			period: req.body.period,
			prorate: req.body.prorate === 'true',
			payFee: req.body.payFee === 'true'
		});
		req.flash( 'success', 'contribution-updated' );
		break;

	case 'force-update':
		await member.update({ $set: {
			'gocardless.customer_id': req.body.customer_id,
			'gocardless.mandate_id': req.body.mandate_id,
			'gocardless.subscription_id': req.body.subscription_id,
			'gocardless.paying_fee': req.body.payFee === 'true',
			contributionMonthlyAmount: Number(req.body.amount),
			contributionPeriod: req.body.period
		} });
		req.flash( 'success', 'gocardless-updated' );
		break;
	}

	res.redirect( req.originalUrl );
} ) );

export default app;

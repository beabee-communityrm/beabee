import express, { NextFunction, Request, Response } from 'express';

import auth from '@core/authentication' ;
import mandrill from '@core/mandrill' ;
import{ hasSchema } from '@core/middleware' ;
import { ContributionPeriod, ContributionType, hasUser, PaymentForm, RequestWithUser, wrapAsync } from '@core/utils' ;

import config from '@config' ;

import JoinFlowService from '@core/services/JoinFlowService' ;
import PaymentService from '@core/services/PaymentService' ;

import { cancelSubscriptionSchema, completeFlowSchema, updateSubscriptionSchema } from './schemas.json';

interface UpdateSubscriptionSchema {
	amount: number,
	payFee: boolean,
	period: ContributionPeriod,
	prorate: boolean,
	useMandate: boolean
}

const app = express();

app.set( 'views', __dirname + '/views' );

app.use( auth.isLoggedIn );

app.use(wrapAsync(async (req, res, next) => {
	res.locals.gcData = await PaymentService.getPaymentData(req.user!);
	next();
}));

function hasSubscription(req: Request, res: Response, next: NextFunction) {
	if ( res.locals.gcData?.subscriptionId ) {
		next();
	} else {
		req.flash( 'danger', 'contribution-doesnt-exist' );
		res.redirect( '/profile/direct-debit' );
	}
}

app.get( '/', wrapAsync( hasUser(async function ( req, res ) {
	res.render( 'index', {
		user: req.user,
		hasPendingPayment: await PaymentService.hasPendingPayment(req.user),
		bankAccount: await PaymentService.getBankAccount(req.user),
		canChange: await PaymentService.canChangeContribution(req.user, !!res.locals.gcData?.mandateId),
		monthsLeft: req.user.memberMonthsRemaining
	} );
} ) ) );

function schemaToPaymentForm(data: UpdateSubscriptionSchema): {useMandate: boolean, paymentForm: PaymentForm} {
	return {
		useMandate: !!data.useMandate,
		paymentForm: {
			amount: data.amount,
			period: data.period,
			payFee: !!data.payFee,
			prorate: data.prorate
		}
	};
}

async function handleChangeContribution(req: RequestWithUser, form: PaymentForm) {
	const wasGift = req.user.contributionType === ContributionType.Gift;
	await PaymentService.updateContribution(req.user, form);
	if (wasGift) {
		await mandrill.sendToMember('welcome-post-gift', req.user);
		req.flash( 'success', 'contribution-gift-updated' );
	} else {
		req.flash( 'success', 'contribution-updated' );
	}
}

app.post( '/', [
	hasSchema(updateSubscriptionSchema).orFlash
], wrapAsync( hasUser(async ( req, res ) => {
	const {useMandate, paymentForm} = schemaToPaymentForm(req.body);

	let redirectUrl = '/profile/direct-debit';

	if ( await PaymentService.canChangeContribution( req.user, useMandate ) ) {
		req.log.info( {
			app: 'direct-debit',
			action: 'update-subscription',
			data: {
				useMandate,
				paymentForm
			}
		} );
		if ( useMandate ) {
			await handleChangeContribution(req, paymentForm);
		} else {
			const completeUrl = config.audience + '/profile/direct-debit/complete';
			redirectUrl = await JoinFlowService.createJoinFlow( completeUrl, paymentForm, {
				prefilled_customer: {
					email: req.user.email,
					given_name: req.user.firstname,
					family_name: req.user.lastname
				}
			} );
		}
	} else {
		req.flash( 'warning', 'contribution-updating-not-allowed' );
	}

	res.redirect( redirectUrl );
} ) ) );

app.get( '/complete', [
	hasSchema( completeFlowSchema ).orRedirect('/profile')
], wrapAsync( hasUser(async (req, res) => {
	if (await PaymentService.canChangeContribution(req.user, false)) {
		const joinFlow = await JoinFlowService.completeJoinFlow( req.query.redirect_flow_id as string );
		if (joinFlow) {
			await PaymentService.updatePaymentMethod(req.user, joinFlow.customerId, joinFlow.mandateId);
			await handleChangeContribution(req, joinFlow.joinForm);
		} else {
			req.flash('warning', 'contribution-updating-failed' );
		}
	} else {
		req.flash( 'warning', 'contribution-updating-not-allowed' );
	}

	res.redirect( '/profile/direct-debit' );
} ) ) );

app.get( '/cancel-subscription', hasSubscription, ( req, res ) => {
	res.render( 'cancel-subscription' );
} );

app.post( '/cancel-subscription', [
	hasSubscription,
	hasSchema(cancelSubscriptionSchema).orFlash
], wrapAsync( hasUser(async ( req, res ) => {
	const { user, body: { satisfied, reason, other } } = req;

	try {
		await user.update( { $set: {
			'cancellation': { satisfied, reason, other }
		} } );

		await PaymentService.cancelContribution( user );

		await mandrill.sendToMember('cancelled-contribution-no-survey', user);

		req.flash( 'success', 'contribution-cancelled' );
	} catch ( error ) {
		req.log.error( {
			app: 'direct-debit',
			action: 'cancel-subscription',
			error
		});

		req.flash( 'danger', 'contribution-cancellation-err' );
	}

	res.redirect( '/profile/direct-debit' );
} ) ) );

export default app;

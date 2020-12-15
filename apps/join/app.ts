import express from 'express';

import auth from '@core/authentication' ;
import { Members } from '@core/database' ;
import mandrill from '@core/mandrill' ;
import { hasModel, hasSchema } from '@core/middleware' ;
import { ContributionPeriod, loginAndRedirect, wrapAsync } from '@core/utils' ;

import config from '@config';

import JoinFlowService, { CompletedJoinFlow }  from '@core/services/JoinFlowService';
import MembersService  from '@core/services/MembersService';
import PaymentService from '@core/services/PaymentService';
import ReferralsService from '@core/services/ReferralsService';

import { JoinForm } from '@models/JoinFlow';
import { Member } from '@models/members';
import RestartFlow from '@models/RestartFlow';

import { joinSchema, referralSchema, completeSchema } from './schemas.json';

interface JoinSchema {
    amount: string,
    amountOther?: string,
    period: ContributionPeriod,
    referralCode?: string,
    referralGift?: string,
    referralGiftOptions?: Record<string, unknown>,
    payFee?: boolean
}

const app = express();

let app_config = {};

app.set( 'views', __dirname + '/views' );

app.use( function( req, res, next ) {
	res.locals.app = app_config;
	next();
} );

app.get( '/' , function( req, res ) {
	res.render( 'index', { user: req.user } );
} );

app.get( '/referral/:code', wrapAsync( async function( req, res ) {
	const referrer = await Members.findOne( { referralCode: req.params.code.toUpperCase() } );
	if ( referrer ) {
		const gifts = await ReferralsService.getGifts();
		res.render( 'index', { user: req.user, referrer, gifts } );
	} else {
		req.flash('warning', 'referral-code-invalid');
		res.redirect( '/join' );
	}
} ) );

function schemaToJoinForm(data: JoinSchema): JoinForm {
	return {
		amount: data.amount === 'other' ? parseInt(data.amountOther) : parseInt(data.amount),
		period: data.period,
		referralCode: data.referralCode,
		referralGift: data.referralGift,
		referralGiftOptions: data.referralGiftOptions,
		payFee: !!data.payFee,
		prorate: false
	};
}

app.post( '/', [
	auth.isNotLoggedIn,
	hasSchema(joinSchema).orFlash
], wrapAsync(async function( req, res ) {
	const joinForm = schemaToJoinForm(req.body);

	const completeUrl = config.audience + app.mountpath + '/complete';
	const redirectUrl = await JoinFlowService.createJoinFlow(completeUrl, joinForm);

	res.redirect( redirectUrl );
}));

app.post( '/referral/:code', [
	auth.isNotLoggedIn,
	hasSchema(joinSchema).orFlash,
	hasSchema(referralSchema).orFlash
], wrapAsync( async function ( req, res ) {
	const joinForm = schemaToJoinForm(req.body);

	if (await ReferralsService.isGiftAvailable(joinForm)) {
		const completeUrl = config.audience + app.mountpath + '/complete';
		const redirectUrl = await JoinFlowService.createJoinFlow(completeUrl, joinForm);
		res.redirect(redirectUrl);
	} else {
		req.flash('warning', 'referral-gift-invalid');
		res.redirect(req.originalUrl);
	}
} ) );

async function handleJoin(member: Member, {customerId, mandateId, joinForm}: CompletedJoinFlow): Promise<void> {
	await PaymentService.updatePaymentMethod(member, customerId, mandateId);
	await PaymentService.updateContribution(member, joinForm);

	if (joinForm.referralCode) {
		const referrer = await Members.findOne({referralCode: joinForm.referralCode});
		await ReferralsService.createReferral(referrer, member, joinForm);
	}
}

app.get( '/complete', [
	auth.isNotLoggedIn,
	hasSchema(completeSchema).orRedirect( '/join' )
], wrapAsync(async function( req, res ) {
	const joinFlow = await JoinFlowService.completeJoinFlow(req.query.redirect_flow_id as string);

	const partialMember = await PaymentService.customerToMember(joinFlow.customerId);
	if (!partialMember) {
		req.log.error({
			app: 'join',
			action: 'invalid-direct-debit',
			data: joinFlow,
		}, 'Customer tried to sign up with invalid direct debit');
		return res.redirect( app.mountpath + '/invalid-direct-debit' );
	}

	try {
		const newMember = await MembersService.createMember(partialMember);
		await handleJoin(newMember, joinFlow);
		await mandrill.sendToMember('welcome', newMember);
		loginAndRedirect(req, res, newMember);
	} catch ( saveError ) {
		// Duplicate email
		if ( saveError.code === 11000 ) {
			const oldMember = await Members.findOne({email: partialMember.email});
			if (oldMember.isActiveMember) {
				res.redirect( app.mountpath + '/duplicate-email' );
			} else {
				const restartFlow = await JoinFlowService.createRestartFlow(oldMember, joinFlow);
				await mandrill.sendToMember('restart-membership', oldMember, {code: restartFlow.id});
				res.redirect( app.mountpath + '/expired-member' );
			}
		} else {
			throw saveError;
		}
	}
}));

app.get('/restart/:id', wrapAsync(async (req, res) => {
	const restartFlow = await JoinFlowService.completeRestartFlow(req.params.id);
	const member = await Members.findById(restartFlow.memberId);

	if (member.isActiveMember) {
		req.flash( 'danger', 'contribution-exists' );
	} else if (await PaymentService.canChangeContribution(member, false)) {
		await handleJoin(member, restartFlow);
	} else {
		req.flash( 'warning', 'contribution-updating-not-allowed' );
	}

	loginAndRedirect(req, res, member);
}));

app.get('/expired-member', (req, res) => {
	res.render('expired-member');
});

app.get('/duplicate-email', (req, res) => {
	res.render('duplicate-email');
});

app.get('/invalid-direct-debit', (req, res) => {
	res.render('invalid-direct-debit');
});

export default function(config): express.Express {
	app_config = config;
	return app;
}

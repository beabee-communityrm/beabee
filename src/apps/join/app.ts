import express, { Request, Response } from 'express';

import { hasSchema, isNotLoggedIn } from '@core/middleware' ;
import { ContributionPeriod, isDuplicateIndex, wrapAsync } from '@core/utils' ;

import config from '@config';

import EmailService from '@core/services/EmailService';
import JoinFlowService, { CompletedJoinFlow }  from '@core/services/JoinFlowService';
import MembersService  from '@core/services/MembersService';
import OptionsService from '@core/services/OptionsService';
import GCPaymentService from '@core/services/GCPaymentService';
import ReferralsService from '@core/services/ReferralsService';

import { NewsletterStatus } from '@core/providers/newsletter';

import JoinForm from '@models/JoinForm';
import Member from '@models/Member';

import { joinSchema, referralSchema, completeSchema } from './schemas.json';

interface JoinSchema {
    amount: string,
    amountOther?: string,
    period: ContributionPeriod,
    referralCode?: string,
    referralGift?: string,
    referralGiftOptions?: Record<string, string>,
    payFee?: boolean
}

const app = express();

app.set( 'views', __dirname + '/views' );

app.get( '/' , function( req, res ) {
	res.render( 'index', { user: req.user } );
} );

app.get( '/referral/:code', wrapAsync( async function( req, res ) {
	const referrer = await MembersService.findOne( { referralCode: req.params.code.toUpperCase() } );
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
		email: '',
		password: {hash: '', iterations: 0, salt: '', tries: 0},
		monthlyAmount: data.amount === 'other' ? parseInt(data.amountOther || '') : parseInt(data.amount),
		period: data.period,
		referralCode: data.referralCode,
		referralGift: data.referralGift,
		referralGiftOptions: data.referralGiftOptions,
		payFee: !!data.payFee,
		prorate: false
	};
}

app.post( '/', [
	isNotLoggedIn,
	hasSchema(joinSchema).orFlash
], wrapAsync(async function( req, res ) {
	const joinForm = schemaToJoinForm(req.body);

	const completeUrl = config.audience + app.mountpath + '/complete';
	const redirectUrl = await JoinFlowService.createJoinFlow(completeUrl, joinForm);

	res.redirect( redirectUrl );
}));

app.post( '/referral/:code', [
	isNotLoggedIn,
	hasSchema(joinSchema).orFlash,
	hasSchema(referralSchema).orFlash
], wrapAsync( async function ( req, res ) {
	const joinForm = schemaToJoinForm(req.body);

	if (await ReferralsService.isGiftAvailable(joinForm, joinForm.monthlyAmount)) {
		const completeUrl = config.audience + app.mountpath + '/complete';
		const redirectUrl = await JoinFlowService.createJoinFlow(completeUrl, joinForm);
		res.redirect(redirectUrl);
	} else {
		req.flash('warning', 'referral-gift-invalid');
		res.redirect(req.originalUrl);
	}
} ) );

async function handleJoin(req: Request, res: Response, member: Member, {customerId, mandateId, joinForm}: CompletedJoinFlow): Promise<void> {
	await GCPaymentService.updatePaymentMethod(member, customerId, mandateId);
	await GCPaymentService.updateContribution(member, joinForm);

	if (joinForm.referralCode) {
		const referrer = await MembersService.findOne({referralCode: joinForm.referralCode});
		await ReferralsService.createReferral(referrer, member, joinForm);
	}

	MembersService.loginAndRedirect(req, res, member, '/profile/complete');
}

app.get( '/complete', [
	isNotLoggedIn,
	hasSchema(completeSchema).orRedirect( '/join' )
], wrapAsync(async function( req, res ) {
	const joinFlow = await JoinFlowService.completeJoinFlow(req.query.redirect_flow_id as string);
	if (!joinFlow) {
		req.log.error({
			app: 'join',
			action: 'no-join-flow',
			data: {
				redirectFlowId: req.query.redirect_flow_id
			}
		}, 'Customer join flow not found');
		return res.redirect( app.mountpath + '/complete/failed');
	}

	const {partialMember, partialProfile} = await GCPaymentService.customerToMember(joinFlow);

	if (!partialMember.firstname) {
		req.log.error({
			app: 'join',
			action: 'invalid-direct-debit',
			data: joinFlow,
		}, 'Customer tried to sign up with invalid direct debit');
		return res.redirect( app.mountpath + '/invalid-direct-debit' );
	}

	try {
		const newMember = await MembersService.createMember(partialMember, {
			...partialProfile,
			newsletterStatus: NewsletterStatus.Subscribed,
			newsletterGroups: OptionsService.getList('newsletter-default-groups')
		});
		await handleJoin(req, res, newMember, joinFlow);
		await EmailService.sendTemplateToMember('welcome', newMember);
	} catch (error) {
		if (isDuplicateIndex(error, 'email')) {
			const oldMember = await MembersService.findOne({email: partialMember.email});
			if (oldMember) {
				if (oldMember.isActiveMember) {
					res.redirect( app.mountpath + '/duplicate-email' );
				} else {
					const restartFlow = await JoinFlowService.createRestartFlow(oldMember, joinFlow);
					await EmailService.sendTemplateToMember('restart-membership', oldMember, {code: restartFlow.id});
					res.redirect( app.mountpath + '/expired-member' );
				}
			} else {
				req.log.error({
					app: 'join',
					action: 'no-old-member-found',
					data: {
						partialMember
					}
				}, 'Old member not found');
				res.redirect( app.mountpath + '/complete/failed');
			}
		} else {
			throw error;
		}
	}
}));

app.get('/complete/failed', (req, res) => {
	res.render('complete-failed');
});

app.get('/restart/failed', (req, res) => {
	res.render('restart-failed');
});

app.get('/restart/:id', wrapAsync(async (req, res, next) => {
	const restartFlow = await JoinFlowService.completeRestartFlow(req.params.id);
	if (restartFlow) {
		if (restartFlow.member.isActiveMember || !await GCPaymentService.canChangeContribution(restartFlow.member, false)) {
			res.redirect( app.mountpath + '/restart/failed' );
		} else {
			await handleJoin(req, res, restartFlow.member, restartFlow);
		}
	} else {
		next('route');
	}
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

export default app;

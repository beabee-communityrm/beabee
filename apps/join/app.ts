import express from 'express';

import auth from '@core/authentication' ;
import { Members, RestartFlows } from '@core/database' ;
import mandrill from '@core/mandrill' ;
import { hasSchema } from '@core/middleware' ;
import { ContributionPeriod, loginAndRedirect, wrapAsync } from '@core/utils' ;

import config from '@config';

import JoinFlowService  from '@core/services/JoinFlowService';
import MembersService  from '@core/services/MembersService';
import PaymentService from '@core/services/PaymentService';
import ReferralsService from '@core/services/ReferralsService';

import { joinSchema, referralSchema, completeSchema } from './schemas.json';
import { JoinForm } from '@models/JoinFlow';

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

app.get( '/complete', [
	auth.isNotLoggedIn,
	hasSchema(completeSchema).orRedirect( '/join' )
], wrapAsync(async function( req, res ) {
	const {customer, mandateId, joinForm} =
		await JoinFlowService.completeJoinFlow(<string>req.query.redirect_flow_id);

	if (PaymentService.isValidCustomer(customer)) {
		const partialMember = PaymentService.customerToMember(customer, mandateId);

		try {
			const newMember = await MembersService.createMember(partialMember);
			await MembersService.startMembership(newMember, joinForm);
			await mandrill.sendToMember('welcome', newMember);
			loginAndRedirect(req, res, newMember);
		} catch ( saveError ) {
			// Duplicate email
			if ( saveError.code === 11000 ) {
				const oldMember = await Members.findOne({email: partialMember.email});
				if (oldMember.isActiveMember || oldMember.hasActiveSubscription) {
					res.redirect( app.mountpath + '/duplicate-email' );
				} else {
					const code = auth.generateCode();

					await RestartFlows.create( {
						code,
						member: oldMember._id,
						customerId: customer.id,
						mandateId,
						joinForm
					} );

					await mandrill.sendToMember('restart-membership', oldMember, {code});

					res.redirect( app.mountpath + '/expired-member' );
				}
			} else {
				throw saveError;
			}
		}
	} else {
		req.log.error({
			app: 'join',
			action: 'invalid-direct-debit',
			data: {
				customerId: customer.id,
				joinForm
			}
		}, 'Customer tried to sign up with invalid direct debit');
		res.redirect( app.mountpath + '/invalid-direct-debit' );
	}
}));

app.get('/restart/:code', wrapAsync(async (req, res) => {
	const restartFlow =
		await RestartFlows.findOneAndRemove({'code': req.params.code}).populate('member').exec();

	if (restartFlow) {
		const {member, customerId, mandateId, joinForm} = restartFlow;

		// Something has created a new subscription in the mean time!
		if (member.isActiveMember || member.hasActiveSubscription) {
			req.flash( 'danger', 'contribution-exists' );
		} else {
			member.gocardless = {
				customer_id: customerId,
				mandate_id: mandateId
			};
			await member.save();

			await MembersService.startMembership(member, joinForm);
			req.flash( 'success', 'contribution-restarted' );
		}

		loginAndRedirect(req, res, member);
	} else {
		req.flash( 'error', 'contribution-restart-code-err' );
		res.redirect('/');
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

export default function(config): express.Express {
	app_config = config;
	return app;
}

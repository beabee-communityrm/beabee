import express from 'express';
import moment from 'moment';
import { getRepository } from 'typeorm';

import config from '@config';

import mailchimp from '@core/lib/mailchimp';
import { isAdmin, isSuperAdmin } from '@core/middleware';
import { wrapAsync } from '@core/utils';
import { canSuperAdmin, generateCode } from '@core/utils/auth';

import MembersService from '@core/services/MembersService';
import OptionsService from '@core/services/OptionsService';
import GCPaymentService from '@core/services/GCPaymentService';
import PaymentService from '@core/services/PaymentService';
import ReferralsService from '@core/services/ReferralsService';

import Member from '@models/Member';

const app = express();

async function getAvailableTags(): Promise<string[]> {
	return OptionsService.getText('available-tags').split(',').map(s => s.trim());
}

app.set( 'views', __dirname + '/views' );

app.use( isAdmin );

app.use(wrapAsync(async (req, res, next) => {
	// Bit of a hack to get parent app params
	const member = await getRepository(Member).findOne({
		where: {id: req.allParams.uuid},
		relations: ['profile']
	});
	if (member) {
		req.model = member;
		res.locals.paymentData = await PaymentService.getPaymentData(member);
		next();
	} else {
		next('route');
	}
}));

app.get( '/', wrapAsync( async ( req, res ) => {
	const member = req.model as Member;
	const payments = await GCPaymentService.getPayments(member);

	const successfulPayments = payments
		.filter(p => p.isSuccessful)
		.map(p => p.amount - p.amountRefunded)
		.filter(amount => !isNaN(amount));

	const total = successfulPayments.reduce((a, b) => a + b, 0);

	const availableTags = await getAvailableTags();

	res.render( 'index', {
		member, payments, total, availableTags,
		password_tries: config['password-tries'],
	} );
} ) );

app.post( '/', wrapAsync( async ( req, res ) => {
	const member = req.model as Member;
	
	if (!req.body.action.startsWith('save-') && !canSuperAdmin(req)) {
		req.flash('error', '403');
		res.redirect(req.baseUrl);
		return;
	}

	switch (req.body.action) {
	case 'save-about': {
		await MembersService.updateMemberProfile(member, {
			tags: req.body.tags || [],
			description: req.body.description || '',
			bio: req.body.bio || ''
		});
		req.flash('success', 'member-updated');
		break;
	}
	case 'save-contact':
		await MembersService.updateMemberProfile(member, {
			telephone: req.body.telephone || '',
			twitter: req.body.twitter || '',
			preferredContact: req.body.preferred || ''
		});
		req.flash('success', 'member-updated');
		break;
	case 'save-notes':
		await MembersService.updateMemberProfile(member, {
			notes: req.body.notes
		});
		req.flash('success', 'member-updated');
		break;
	case 'login-override':
		await MembersService.updateMember(member, {
			loginOverride: {code: generateCode(), expires: moment().add(24, 'hours').toDate()}
		});
		req.flash('success', 'member-login-override-generated');
		break;
	case 'password-reset':
		await MembersService.updateMember(member, {
			password: {...member.password, resetCode: generateCode()}
		});
		req.flash('success', 'member-password-reset-generated');
		break;
	case 'permanently-delete':
		// TODO: anonymise other data in poll answers
		//await PollAnswers.updateMany( { member }, { $set: { member: null } } );
		// TODO: await RestartFlows.deleteMany( { member } );

		await ReferralsService.permanentlyDeleteMember(member);
		await GCPaymentService.permanentlyDeleteMember(member);

		await MembersService.permanentlyDeleteMember(member);

		await mailchimp.mainList.permanentlyDeleteMember(member);

		req.flash('success', 'member-permanently-deleted');
		res.redirect('/members');
		return;
	}

	res.redirect(req.baseUrl);
} ) );

const adminApp = express.Router( { mergeParams: true } );
app.use(adminApp);

adminApp.use(isSuperAdmin);

adminApp.get( '/2fa', ( req, res ) => {
	res.render( '2fa', { member: req.model } );
} );

adminApp.post( '/2fa', wrapAsync( async ( req, res ) => {
	await MembersService.updateMember(req.model as Member, {
		otp: {key: undefined, activated: false}
	});
	req.flash( 'success', '2fa-disabled' );
	res.redirect( req.baseUrl );
} ) );

export default app;

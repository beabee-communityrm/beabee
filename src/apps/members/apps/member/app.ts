import express from 'express';
import _ from 'lodash';
import moment from 'moment';

import config from '@config';

import auth from '@core/authentication';
import { Members } from '@core/database';
import mailchimp from '@core/mailchimp';
import { wrapAsync } from '@core/utils';

import OptionsService from '@core/services/OptionsService';
import GCPaymentService from '@core/services/GCPaymentService';
import PaymentService from '@core/services/PaymentService';
import ReferralsService from '@core/services/ReferralsService';

import { Member } from '@models/members';

const app = express();

async function getAvailableTags(): Promise<string[]> {
	return OptionsService.getText('available-tags').split(',').map(s => s.trim());
}

app.set( 'views', __dirname + '/views' );

app.use( auth.isAdmin );

app.use(wrapAsync(async (req, res, next) => {
	// Bit of a hack to get parent app params
	req.model = await Members.findOne({uuid: req.allParams.uuid}).populate('permissions.permission').exec();
	if (req.model) {
		res.locals.paymentData = await PaymentService.getPaymentData(req.model as Member);
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
		audience: config.audience,
		password_tries: config['password-tries'],
	} );
} ) );

app.post( '/', wrapAsync( async ( req, res ) => {
	const member = req.model as Member;
	
	if (!req.body.action.startsWith('save-') && !auth.canSuperAdmin(req)) {
		req.flash('error', '403');
		res.redirect(req.baseUrl);
		return;
	}

	switch (req.body.action) {
	case 'save-about': {
		const exisingTagNames = member.tags.map(tag => tag.name);
		const newTagNames = _.difference(req.body.tags, exisingTagNames);
		const deletedTagNames = _.difference(exisingTagNames, req.body.tags);

		for (const tagName of deletedTagNames) {
			(member.tags as any).find((tag: any) => tag.name === tagName).remove();
		}
		for (const tagName of newTagNames) {
			member.tags.push({name: tagName});
		}

		member.description = req.body.description;
		member.bio = req.body.bio;

		await member.save();

		req.flash('success', 'member-updated');
		break;
	}
	case 'save-contact':
		await member.update({$set: {
			'contact.telephone': req.body.telephone,
			'contact.twitter': req.body.twitter,
			'contact.preferred': req.body.preferred
		}});
		req.flash('success', 'member-updated');
		break;
	case 'save-notes':
		await member.update({$set: {
			'notes': req.body.notes
		}});
		req.flash('success', 'member-updated');
		break;
	case 'login-override':
		await member.update({$set: {
			loginOverride: {
				code: auth.generateCode(),
				expires: moment().add(24, 'hours').toDate()
			}
		}});
		req.flash('success', 'member-login-override-generated');
		break;
	case 'password-reset':
		await member.update({$set: {
			'password.reset_code': auth.generateCode()
		}});
		req.flash('success', 'member-password-reset-generated');
		break;
	case 'permanently-delete':
		// TODO: anonymise other data in poll answers
		//await PollAnswers.updateMany( { member }, { $set: { member: null } } );
		// TODO: await RestartFlows.deleteMany( { member } );
		
		await Members.deleteOne( { _id: member._id } );

		await ReferralsService.permanentlyDeleteMember(member);
		await GCPaymentService.permanentlyDeleteMember(member);

		await mailchimp.mainList.permanentlyDeleteMember(member);

		req.flash('success', 'member-permanently-deleted');
		res.redirect('/members');
		return;
	}

	res.redirect(req.baseUrl);
} ) );

const adminApp = express.Router( { mergeParams: true } );
app.use(adminApp);

adminApp.use(auth.isSuperAdmin);

adminApp.get( '/2fa', ( req, res ) => {
	res.render( '2fa', { member: req.model } );
} );

adminApp.post( '/2fa', wrapAsync( async ( req, res ) => {
	await (req.model as Member).update({$set: {'opt.key': ''}});
	req.flash( 'success', '2fa-disabled' );
	res.redirect( req.baseUrl );
} ) );

export default app;

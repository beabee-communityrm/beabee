const express = require( 'express' );
const _ = require( 'lodash' );
const moment = require( 'moment' );

const config = require( '@config' );

const auth = require( '@core/authentication' );
const {
	GiftFlows, Members, PollAnswers, Referrals
} = require( '@core/database' );
const mailchimp = require( '@core/mailchimp' );
const mandrill = require( '@core/mandrill' );
const { hasModel } = require( '@core/middleware' );
const { wrapAsync } = require( '@core/utils' );

const { default: OptionsService } = require( '@core/services/OptionsService' );
const { default: PaymentService } = require( '@core/services/PaymentService' );

const app = express();
var app_config = {};

function getAvailableTags() {
	return Promise.resolve(OptionsService.getText('available-tags').split(',').map(s => s.trim()));
}

app.set( 'views', __dirname + '/views' );

app.use( ( req, res, next ) => {
	res.locals.app = app_config;
	next();
} );

app.use( auth.isAdmin );

// Bit of a hack to get parent app params
app.use((req, res, next) => {
	req.params = req.allParams;
	hasModel(Members, 'uuid')(req, res, () => {
		req.model.populate('permissions.permission', next);
	});
});

app.get( '/', wrapAsync( async ( req, res ) => {
	const member = req.model;
	const payments = await PaymentService.getPayments(member);

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
	const member = req.model;
	
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

		for (let tagName of deletedTagNames) {
			member.tags.find(tag => tag.name === tagName).remove();
		}
		for (let tagName of newTagNames) {
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
		await PollAnswers.updateMany( { member }, { $set: { member: null } } );
		await GiftFlows.updateMany( { member }, { $set: { member: null } } );
		// TODO: await RestartFlows.deleteMany( { member } );
		await Referrals.updateMany( { referrer: member }, { $set: { referrer: null } } );
		await Members.deleteOne( { _id: member._id } );

		await PaymentService.permanentlyDeleteMember(member);

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

adminApp.get( '/emails', (req, res) => {
	res.render( 'emails' , { member: req.model } );
} );

adminApp.post( '/emails', wrapAsync( async ( req, res ) => {
	await mandrill.sendToMember(req.body.email, req.model);
	req.flash( 'success', 'emails-sent');
	res.redirect(req.baseUrl + '/emails');
} ) );

adminApp.get( '/2fa', ( req, res ) => {
	res.render( '2fa', { member: req.model } );
} );

adminApp.post( '/2fa', wrapAsync( async ( req, res ) => {
	await req.model.update({$set: {'opt.key': ''}});
	req.flash( 'success', '2fa-disabled' );
	res.redirect( req.baseUrl );
} ) );

module.exports = ( config ) => {
	app_config = config;
	return app;
};

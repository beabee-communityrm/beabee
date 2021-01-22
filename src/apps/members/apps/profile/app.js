const express = require( 'express' );
const _ = require( 'lodash' );
const moment = require( 'moment' );

const config = require( '@config' );

const auth = require( '@core/authentication' );
const {
	Exports, GiftFlows, Members, Permissions, PollAnswers, Referrals
} = require( '@core/database' );
const mailchimp = require( '@core/mailchimp' );
const mandrill = require( '@core/mandrill' );
const { hasModel, hasSchema } = require( '@core/middleware' );
const { cleanEmailAddress, wrapAsync } = require( '@core/utils' );

const { default: MembersService } = require( '@core/services/MembersService' );
const { default: OptionsService } = require( '@core/services/OptionsService' );
const { default: PaymentService } = require( '@core/services/PaymentService' );

const exportTypes = require( '@apps/tools/apps/exports/exports');

const { updateProfileSchema } = require('./schemas.json');

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

adminApp.get( '/profile', ( req, res ) => {
	res.render( 'update', { member: req.model } );
} );

adminApp.post( '/profile', [
	hasSchema(updateProfileSchema).orFlash
], wrapAsync( async ( req, res ) => {
	const {
		body: {
			email, firstname, lastname, delivery_optin, delivery_line1,
			delivery_line2, delivery_city, delivery_postcode
		}
	} = req;

	const cleanedEmail = cleanEmailAddress(email);

	try {
		await MembersService.updateMember(req.model, {
			email: cleanedEmail,
			firstname,
			lastname,
			delivery_optin,
			delivery_address: delivery_optin ? {
				line1: delivery_line1,
				line2: delivery_line2,
				city: delivery_city,
				postcode: delivery_postcode
			} : {}
		});
	} catch ( saveError ) {
		// Duplicate key (on email)
		if ( saveError.code === 11000 ) {
			req.flash( 'danger', 'email-duplicate' );
		} else {
			throw saveError;
		}
	}

	res.redirect(req.baseUrl + '/profile');
} ) );

adminApp.get( '/emails', (req, res) => {
	res.render( 'emails' , { member: req.model } );
} );

adminApp.post( '/emails', wrapAsync( async ( req, res ) => {
	await mandrill.sendToMember(req.body.email, req.model);
	req.flash( 'success', 'emails-sent');
	res.redirect(req.baseUrl + '/emails');
} ) );

adminApp.get( '/exports', wrapAsync( async ( req, res ) => {
	// Only show member-based exports
	const exports = (await Exports.find()).filter(exportDetails => (
		exportTypes[exportDetails.type].collection === Members
	));

	await req.model.populate('exports.export_id').execPopulate();

	res.render('exports', {member: req.model, exports, exportTypes});
} ) );

adminApp.post( '/exports', wrapAsync( async ( req, res ) => {
	if (req.body.action === 'update') {
		await Members.updateOne( {
			uuid: req.params.uuid,
			exports: { $elemMatch: {
				export_id: req.body.export_id
			} }
		}, {
			'exports.$.status': req.body.status
		} );
		req.flash('success', 'exports-updated');

	} else if (req.body.action === 'add') {
		const exportDetails = await Exports.findById(req.body.export_id);
		const exportType = exportTypes[exportDetails.type];

		// Check member is eligible
		const member = await Members.findOne( {
			...await exportType.getQuery(exportDetails),
			exports: {$not: {$elemMatch: {
				export_id: exportDetails
			}}},
			uuid: req.params.uuid
		} );

		if (member) {
			await member.update( {
				$push: {
					exports: {
						export_id: exportDetails,
						status: exportType.statuses[0]
					}
				}
			} );

			req.flash( 'success', 'exports-added-one' );
		} else {
			req.flash( 'error', 'exports-ineligible' );
		}
	}

	res.redirect( req.baseUrl + '/exports' );
} ) );

adminApp.get( '/gocardless', wrapAsync( async ( req, res ) => {
	res.render( 'gocardless', {
		member: req.model,
		canChange: await PaymentService.canChangeContribution( req.model, req.model.canTakePayment ),
		monthsLeft: PaymentService.getMonthsLeftOnContribution( req.model )
	} );
} ) );

adminApp.post( '/gocardless', wrapAsync( async ( req, res ) => {
	const member = req.model;

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
			'gocardless.amount': Number(req.body.amount),
			'gocardless.period': req.body.period,
			'gocardless.paying_fee': req.body.payFee === 'true'
		} });
		req.flash( 'success', 'gocardless-updated' );
		break;
	}

	res.redirect( req.baseUrl + '/gocardless' );
} ) );

adminApp.get( '/permissions', wrapAsync( async ( req, res ) => {
	const permissions = await Permissions.find();
	res.render( 'permissions', { permissions, member: req.model } );
} ) );

adminApp.post( '/permissions', wrapAsync( async (req, res ) => {
	const { permission: slug, start_time, start_date, expiry_date, expiry_time } = req.body;
	if ( !slug ) {
		req.flash( 'danger', 'information-ommited' );
		res.redirect( req.originalUrl );
		return;
	}

	const permission = await Permissions.findOne( { slug } );
	if ( !permission ) {
		req.flash( 'warning', 'permission-404' );
		res.redirect( req.originalUrl );
		return;
	}

	const dupe = req.model.permissions.find(p => p.permission.equals(permission));
	if ( dupe ) {
		req.flash( 'danger', 'permission-duplicate' );
		res.redirect( req.originalUrl );
		return;
	}

	const new_permission = {
		permission: permission._id,
		date_added: start_date && start_time ? moment( start_date + 'T' + start_time ) : moment()
	};

	if ( expiry_date && expiry_time ) {
		new_permission.date_expires = moment( expiry_date + 'T' + expiry_time );
		if ( new_permission.date_added >= new_permission.date_expires ) {
			req.flash( 'warning', 'permission-expiry-error' );
			res.redirect( req.originalUrl );
			return;
		}
	}

	req.model.permissions.push(new_permission);
	await req.model.save();

	res.redirect( req.originalUrl );
} ) );

adminApp.get( '/permissions/:id/modify', wrapAsync( async ( req, res ) =>{
	const member = req.model;

	const permission = member.permissions.id(req.params.id);
	if ( permission ) {
		res.render( 'permission', { member, current: permission } );
	} else {
		req.flash( 'warning', 'permission-404' );
		res.redirect( req.baseUrl );
	}
} ) );

adminApp.post( '/permissions/:id/modify', wrapAsync( async ( req, res ) => {
	const { model: member, body: { start_date, start_time, expiry_date, expiry_time } } = req;

	const permission = member.permissions.id( req.params.id );
	if ( !permission ) {
		req.flash( 'warning', 'permission-404' );
		res.redirect( req.baseUrl );
		return;
	}

	if ( start_date !== '' && start_time !== '' ) {
		permission.date_added = moment( start_date + 'T' + start_time ).toDate();
	}

	if ( expiry_date !== '' && expiry_time !== '' ) {
		permission.date_expires = moment( expiry_date + 'T' + expiry_time ).toDate();

		if ( permission.date_added >= permission.date_expires ) {
			req.flash( 'warning', 'permission-expiry-error' );
			res.redirect( req.baseUrl + '/permissions' );
			return;
		}
	} else {
		permission.date_expires = null;
	}

	await member.save();

	req.flash( 'success', 'permission-updated' );
	res.redirect( req.baseUrl + '/permissions' );
} ) );

adminApp.post( '/permissions/:id/revoke', wrapAsync( async ( req, res ) => {
	const member = req.model;
	const permission = member.permissions.id( req.params.id );
	if ( permission ) {
		permission.remove();
		await member.save();
		req.flash( 'success', 'permission-removed' );
	} else {
		req.flash( 'warning', 'permission-404' );
	}
	res.redirect( req.baseUrl + '/permissions' );
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

const escapeStringRegexp = require( 'escape-string-regexp' );
const express = require( 'express' );
const queryString = require('query-string');
const _ = require( 'lodash' );
const moment = require( 'moment' );

const config = require( __config );

const auth = require( __js + '/authentication' );
const {
	Exports, GiftFlows, Members, Permissions, Payments, PollAnswers,
	Referrals, RestartFlows
} = require( __js + '/database' );
const gocardless = require( __js + '/gocardless' );
const mailchimp = require( __js + '/mailchimp' );
const mandrill = require( __js + '/mandrill' );
const { hasModel, hasSchema } = require( __js + '/middleware' );
const Options = require( __js + '/options' )();
const { cleanEmailAddress, wrapAsync } = require( __js + '/utils' );

const { isValidCustomer, createMember, customerToMember, startMembership } = require( __apps + '/join/utils' );
const { syncMemberDetails } = require( __apps + '/profile/apps/account/utils' );
const exportTypes = require( __apps + '/tools/apps/exports/exports');

const { updateProfileSchema } = require('./schemas.json');

const app = express();
var app_config = {};

app.set( 'views', __dirname + '/views' );

app.use( ( req, res, next ) => {
	res.locals.app = app_config;
	next();
} );

app.use( auth.isAdmin );

function fuzzyMatch(s) {
	return new RegExp( '.*' + escapeStringRegexp( s.trim() ) + '.*', 'i' );
}

function getAvailableTags() {
	return Promise.resolve(Options.getText('available-tags').split(',').map(s => s.trim()));
}

app.get( '/', wrapAsync( async ( req, res ) => {
	const { query } = req;
	const permissions = await Permissions.find();
	const availableTags = await getAvailableTags();

	let search = [];

	if (query.permission || !query.show_inactive) {
		const permissionSearch = {
			...(query.permission && {
				permission: permissions.find(p => p.slug === query.permission)
			}),
			...(!query.show_inactive && {
				date_added: { $lte: new Date() },
				$or: [
					{ date_expires: null },
					{ date_expires: { $gt: new Date() } }
				]
			})
		};

		search.push( { permissions: { $elemMatch: permissionSearch } } );
	}

	if ( query.firstname ) {
		search.push( { firstname:  fuzzyMatch( query.firstname ) } );
	}
	if ( query.lastname ) {
		search.push( { lastname: fuzzyMatch( query.lastname ) } );
	}
	if ( query.email ) {
		search.push( { email: fuzzyMatch( query.email ) } );
	}
	if ( query.tag ) {
		search.push( { tags: { $elemMatch: { name: query.tag } } } );
	}

	const filter = search.length > 0 ? { $and: search } : {};

	const total = await Members.count( filter );

	const limit = 25;
	const page = query.page ? parseInt( query.page ) : 1;

	const pages = [ ...Array( Math.ceil( total / limit ) ) ].map( ( v, page ) => ( {
		number: page + 1,
		path: '/members?' + queryString.stringify( { ...query, page: page + 1 } )
	} ) );

	const next = page + 1 <= pages.length ? pages[ page ] : null;
	const prev = page - 1 > 0 ? pages[ page - 2 ] : null;

	const pagination = {
		pages, page, prev, next,
		total: pages.length
	};

	const members = await Members.find( filter ).limit( limit ).skip( limit * ( page - 1 ) ).sort( [ [ 'lastname', 1 ], [ 'firstname', 1 ] ] );

	res.render( 'index', {
		permissions, availableTags, search: query,
		members, pagination, total,
		count: members ? members.length : 0,
	} );
} ) );

app.get( '/add', auth.isSuperAdmin, ( req, res ) => {
	res.render( 'add' );
} );

app.post( '/add', auth.isSuperAdmin, wrapAsync( async ( req, res ) => {
	const customer = await gocardless.customers.get(req.body.customer_id);
	if (req.body.first_name) {
		customer.given_name = req.body.first_name;
	}
	if (req.body.last_name) {
		customer.family_name = req.body.last_name;
	}
	if (isValidCustomer(customer)) {
		const member = await createMember( customerToMember( customer, req.body.mandate_id ) );
		res.redirect( app.mountpath + '/' + member.uuid );
	} else {
		req.flash('error', 'member-add-invalid-direct-debit');
		res.redirect( app.mountpath + '/add' );
	}
} ) );

const memberRouter = express.Router( { mergeParams: true } );
app.use('/:uuid', memberRouter);

memberRouter.use(hasModel(Members, 'uuid'));
memberRouter.use((req, res, next) => {
	req.model.populate('permissions.permission', next);
});

memberRouter.get( '/', wrapAsync( async ( req, res ) => {
	const member = req.model;
	const payments = await Payments.find( { member: member._id } ).sort( { 'charge_date': -1 } ).exec();

	const confirmedPayments = payments
		.filter(p => ['paid_out', 'confirmed'].indexOf(p.status) > -1)
		.map(p => p.amount - p.amount_refunded)
		.filter(amount => !isNaN(amount));

	const total = confirmedPayments.reduce((a, b) => a + b, 0);

	const availableTags = await getAvailableTags();

	res.render( 'member', {
		member, payments, total, availableTags,
		audience: config.audience,
		password_tries: config['password-tries'],
	} );
} ) );

memberRouter.post( '/', wrapAsync( async ( req, res ) => {
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
		await Payments.deleteMany( { member } );
		// TODO: anonymise other data in poll answers
		await PollAnswers.updateMany( { member }, { $set: { member: null } } );
		await GiftFlows.updateMany( { member }, { $set: { member: null } } );
		await RestartFlows.deleteMany( { member } );
		await Referrals.updateMany( { referrer: member }, { $set: { referrer: null } } );
		await Members.deleteOne( { _id: member._id } );

		if ( member.gocardless.mandate_id ) {
			await gocardless.mandates.cancel( member.gocardless.mandate_id );
		}
		if ( member.gocardless.customer_id ) {
			await gocardless.customers.remove( member.gocardless.customer_id );
		}
		await mailchimp.defaultLists.members.permanentlyDelete( member.email );

		req.flash('success', 'member-permanently-deleted');
		res.redirect('/members');
		return;
	}

	res.redirect(req.baseUrl);
} ) );

const memberAdminRouter = express.Router( { mergeParams: true } );
memberRouter.use(memberAdminRouter);

memberAdminRouter.use(auth.isSuperAdmin);

memberAdminRouter.get( '/profile', ( req, res ) => {
	res.render( 'update', { member: req.model } );
} );

memberAdminRouter.post( '/profile', [
	hasSchema(updateProfileSchema).orFlash
], wrapAsync( async ( req, res ) => {
	const {
		model: member,
		body: {
			email, firstname, lastname, delivery_optin, delivery_line1,
			delivery_line2, delivery_city, delivery_postcode
		}
	} = req;

	const cleanedEmail = cleanEmailAddress(email);

	const needsSync = cleanedEmail !== member.email ||
		firstname !== member.firstname ||
		lastname !== member.lastname;

	try {
		const oldEmail = member.email;

		member.email = cleanedEmail;
		member.firstname = firstname;
		member.lastname = lastname;
		member.delivery_optin = delivery_optin;
		member.delivery_address = delivery_optin ? {
			line1: delivery_line1,
			line2: delivery_line2,
			city: delivery_city,
			postcode: delivery_postcode
		} : {};
		await member.save();

		if ( needsSync ) {
			await syncMemberDetails( member, oldEmail );
		}
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

memberAdminRouter.get( '/emails', (req, res) => {
	res.render( 'emails' , { member: req.model } );
} );

memberAdminRouter.post( '/emails', wrapAsync( async ( req, res ) => {
	await mandrill.sendToMember(req.body.email, req.model);
	req.flash( 'success', 'emails-sent');
	res.redirect(req.baseUrl + '/emails');
} ) );

memberAdminRouter.get( '/exports', wrapAsync( async ( req, res ) => {
	// Only show member-based exports
	const exports = (await Exports.find()).filter(exportDetails => (
		exportTypes[exportDetails.type].collection === Members
	));

	await req.model.populate('exports.export_id').execPopulate();

	res.render('exports', {member: req.model, exports, exportTypes});
} ) );

memberAdminRouter.post( '/exports', wrapAsync( async ( req, res ) => {
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

memberAdminRouter.get( '/gocardless', ( req, res ) => {
	res.render( 'gocardless', { member: req.model } );
} );

memberAdminRouter.post( '/gocardless', wrapAsync( async ( req, res ) => {
	const member = req.model;

	switch ( req.body.action ) {
	case 'create-subscription':
		await startMembership(member, {
			amount: Number(req.body.amount),
			period: req.body.period
		});
		break;

	case 'force-update':
		await member.update({ $set: {
			'gocardless.customer_id': req.body.customer_id,
			'gocardless.mandate_id': req.body.mandate_id,
			'gocardless.subscription_id': req.body.subscription_id,
			'gocardless.amount': Number(req.body.amount),
			'gocardless.period': req.body.period,
			'gocardless.paying_fee': req.body.paying_fee
		} });
		break;
	}

	req.flash( 'success', 'gocardless-updated' );
	res.redirect( req.baseUrl + '/gocardless' );
} ) );

memberAdminRouter.get( '/permissions', wrapAsync( async ( req, res ) => {
	const permissions = await Permissions.find();
	res.render( 'permissions', { permissions, member: req.model } );
} ) );

memberAdminRouter.post( '/permissions', wrapAsync( async (req, res ) => {
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

memberAdminRouter.get( '/permissions/:id/modify', wrapAsync( async ( req, res ) =>{
	const member = req.model;

	const permission = member.permissions.id(req.params.id);
	if ( permission ) {
		res.render( 'permission', { member, current: permission } );
	} else {
		req.flash( 'warning', 'permission-404' );
		res.redirect( req.baseUrl );
	}
} ) );

memberAdminRouter.post( '/permissions/:id/modify', wrapAsync( async ( req, res ) => {
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

memberAdminRouter.post( '/permissions/:id/revoke', wrapAsync( async ( req, res ) => {
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

memberAdminRouter.get( '/2fa', ( req, res ) => {
	res.render( '2fa', { member: req.model } );
} );

memberAdminRouter.post( '/2fa', wrapAsync( async ( req, res ) => {
	await req.model.update({$set: {'opt.key': ''}});
	req.flash( 'success', '2fa-disabled' );
	res.redirect( req.baseUrl );
} ) );

module.exports = ( config ) => {
	app_config = config;
	return app;
};

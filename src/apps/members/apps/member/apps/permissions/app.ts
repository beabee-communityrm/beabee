import express from 'express';

import auth from '@core/authentication';
import { AppConfig, wrapAsync } from '@core/utils';

import { Member, Permission } from '@models/members';
import { Permissions } from '@core/database';
import moment from 'moment';

const app = express();

app.set( 'views', __dirname + '/views' );

app.use(auth.isSuperAdmin);

app.get( '/', wrapAsync( async ( req, res ) => {
	const permissions = await Permissions.find();
	res.render( 'index', { permissions, member: req.model } );
} ) );

app.post( '/', wrapAsync( async (req, res ) => {
	const { permission: slug, start_time, start_date, expiry_date, expiry_time } = req.body;
	const member = req.model as Member;

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

	const dupe = member.permissions.find(p => (p.permission as any).equals(permission));
	if ( dupe ) {
		req.flash( 'danger', 'permission-duplicate' );
		res.redirect( req.originalUrl );
		return;
	}

	const new_permission: Permission = {
		permission: permission._id,
		date_added: (start_date && start_time ? moment( start_date + 'T' + start_time ) : moment()).toDate()
	};

	if ( expiry_date && expiry_time ) {
		new_permission.date_expires = moment( expiry_date + 'T' + expiry_time ).toDate();
		if ( new_permission.date_added >= new_permission.date_expires ) {
			req.flash( 'warning', 'permission-expiry-error' );
			res.redirect( req.originalUrl );
			return;
		}
	}

	member.permissions.push(new_permission);
	await member.save();

	res.redirect( req.originalUrl );
} ) );

app.get( '/:id/modify', wrapAsync( async ( req, res ) =>{
	const member = req.model as Member;

	const permission = member.permissions.id(req.params.id);
	if ( permission ) {
		res.render( 'permission', { member, current: permission } );
	} else {
		req.flash( 'warning', 'permission-404' );
		res.redirect( req.baseUrl );
	}
} ) );

app.post( '/:id/modify', wrapAsync( async ( req, res ) => {
	const { body: { start_date, start_time, expiry_date, expiry_time } } = req;
	const member = req.model as Member;

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
			res.redirect( req.baseUrl );
			return;
		}
	} else {
		permission.date_expires = undefined;
	}

	await member.save();

	req.flash( 'success', 'permission-updated' );
	res.redirect( req.baseUrl );
} ) );

app.post( '/:id/revoke', wrapAsync( async ( req, res ) => {
	const member = req.model as Member;
	const permission = member.permissions.id( req.params.id );
	if ( permission ) {
		permission.remove!();
		await member.save();
		req.flash( 'success', 'permission-removed' );
	} else {
		req.flash( 'warning', 'permission-404' );
	}
	res.redirect( req.baseUrl );
} ) );


export default function (config: AppConfig): express.Express {
	return app;
}

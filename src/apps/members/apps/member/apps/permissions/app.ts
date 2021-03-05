import express from 'express';
import moment from 'moment';
import { getRepository } from 'typeorm';

import { hasSchema, isSuperAdmin } from '@core/middleware';
import { wrapAsync } from '@core/utils';

import { Member } from '@models/members';
import MemberPermission, { PermissionType } from '@models/MemberPermission';

import { createPermissionSchema, updatePermissionSchema } from './schemas.json';

const app = express();

app.set( 'views', __dirname + '/views' );

app.use(isSuperAdmin);

app.get( '/', wrapAsync( async ( req, res ) => {
	res.render( 'index', { member: req.model } );
} ) );

app.post( '/', hasSchema(createPermissionSchema).orFlash, wrapAsync( async (req, res ) => {
	const { permission, startTime, startDate, expiryDate, expiryTime } = req.body;
	const member = req.model as Member;

	const dupe = member.permissions.find(p => p.permission === permission);
	if ( dupe ) {
		req.flash( 'danger', 'permission-duplicate' );
		res.redirect( req.originalUrl );
		return;
	}

	const newPermission = new MemberPermission();
	newPermission.permission = permission;
	newPermission.memberId = member.id;
	newPermission.dateAdded = moment(startDate + 'T' + startTime).toDate();

	if (expiryDate && expiryTime) {
		newPermission.dateExpires = moment(expiryDate + 'T' + expiryTime).toDate();
		if (newPermission.dateAdded >= newPermission.dateExpires) {
			req.flash( 'warning', 'permission-expiry-error' );
			res.redirect( req.originalUrl );
			return;
		}
	}

	await getRepository(MemberPermission).save(newPermission);

	res.redirect( req.originalUrl );
} ) );

app.get( '/:id/modify', wrapAsync( async ( req, res ) =>{
	const member = req.model as Member;

	const permission = member.permissions.find(p => p.permission === req.params.id);
	if ( permission ) {
		res.render( 'permission', { member, current: permission } );
	} else {
		req.flash( 'warning', 'permission-404' );
		res.redirect( req.baseUrl );
	}
} ) );

app.post( '/:id/modify', hasSchema(updatePermissionSchema).orFlash, wrapAsync( async ( req, res, next ) => {
	const { body: { startDate, startTime, expiryDate, expiryTime } } = req;
	const member = req.model as Member;

	const permission = member.permissions.find(p => p.permission === req.params.id);
	if ( !permission ) {
		return next('route');
	}

	const dateAdded = moment(startDate + 'T' + startTime).toDate();
	const dateExpires = expiryDate && expiryTime ? moment(expiryDate + 'T' + expiryTime).toDate() : undefined;

	if ( dateExpires && dateAdded >= dateExpires ) {
		req.flash( 'warning', 'permission-expiry-error' );
		res.redirect( req.baseUrl );
		return;
	}

	await getRepository(MemberPermission).save({...permission, dateAdded, dateExpires});

	req.flash( 'success', 'permission-updated' );
	res.redirect( req.baseUrl );
} ) );

app.post( '/:id/revoke', wrapAsync( async ( req, res ) => {
	const member = req.model as Member;
	const permission = req.params.id as PermissionType;
	await getRepository(MemberPermission).delete({memberId: member.id, permission});

	req.flash( 'success', 'permission-removed' );
	res.redirect( req.baseUrl );
} ) );


export default app;

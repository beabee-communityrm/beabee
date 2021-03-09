import express from 'express';
import passport from 'passport';
import { getRepository } from 'typeorm';

import { isValidNextUrl, getNextParam, loginAndRedirect, wrapAsync } from '@core/utils';

import Member from '@models/Member';
import MemberPermission, { PermissionType } from '@models/MemberPermission';

import config from '@config';
import moment from 'moment';

const app = express();

app.set( 'views', __dirname + '/views' );

app.get( '/' , function( req, res ) {
	const nextParam = req.query.next as string;
	if ( req.user ) {
		res.redirect( isValidNextUrl(nextParam) ? nextParam : '/' );
	} else {
		res.render( 'index', { nextParam: getNextParam( nextParam ) } );
	}
} );

if (config.dev) {
	app.get('/as/:permission', wrapAsync( async (req, res) => {
		const permission = await getRepository(MemberPermission).findOne({
			where: {
				permission: req.params.permission as PermissionType
			},
			relations: ['member']
		});
		if (permission) {
			loginAndRedirect(req, res, permission.member);
		} else {
			res.redirect('/login');
		}
	}));
}

app.get( '/:code', wrapAsync( async function( req, res ) {
	const nextParam = req.query.next as string;
	const member = await getRepository(Member).findOne({loginOverride: {code: req.params.code}});

	if (member && member.loginOverride && moment.utc(member.loginOverride.expires).isAfter()) {
		loginAndRedirect(req, res, member, isValidNextUrl(nextParam) ? nextParam : '/');
	} else {
		req.flash('error', 'login-code-invalid');
		res.redirect( '/login' );
	}
} ) );

app.post( '/', (req, res) => {
	const nextParam = req.query.next as string;
	passport.authenticate( 'local', {
		failureRedirect: '/login' + getNextParam( nextParam ),
		failureFlash: true
	} )( req, res, () => {
		req.session.method = 'plain';
		res.redirect( isValidNextUrl( nextParam ) ? nextParam : '/' );
	} );
} );

export default app;

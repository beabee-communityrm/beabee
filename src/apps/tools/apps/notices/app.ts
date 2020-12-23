import express from 'express';
import moment from 'moment';
import { getCustomRepository } from 'typeorm';

import auth from '@core/authentication';
import { hasNewModel, hasSchema } from '@core/middleware';
import { wrapAsync } from '@core/utils';

import NoticeRepository from '@core/repositories/NoticeRepository';

import { createNoticeSchema } from './schemas.json';
import Notice from '@models/Notice';

const app = express();
let app_config;

interface NoticeSchema {
	name: string,
	expiresDate?: string,
	expiresTime?: string,
	text: string,
	url?: string,
	enabled?: boolean
}

function schemaToNotice(data: NoticeSchema): Notice {
	const notice = new Notice();
	notice.name = data.name;
	notice.expires = data.expiresDate && data.expiresTime ?
		moment.utc(`${data.expiresDate}T${data.expiresTime}`).toDate() : null;
	notice.text = data.text;
	notice.url = data.url;
	notice.enabled = !!data.enabled;

	return notice;
}

app.set( 'views', __dirname + '/views' );

app.use( auth.isAdmin );

app.use( ( req, res, next ) => {
	res.locals.app = app_config;
	res.locals.breadcrumb.push( {
		name: app_config.title,
		url: app.mountpath
	} );
	next();
} );

app.get( '/', wrapAsync( async ( req, res ) => {
	const notices = await getCustomRepository(NoticeRepository).find();
	res.render( 'index', { notices } );
} ) );

app.post( '/', hasSchema( createNoticeSchema ).orFlash, wrapAsync( async ( req, res ) => {
	const notice = schemaToNotice(req.body);
	await getCustomRepository(NoticeRepository).save(notice);
	req.flash('success', 'notices-created');
	res.redirect('/tools/notices/' + notice.id);
} ) );

app.get( '/:id', hasNewModel(NoticeRepository, 'id'), wrapAsync( async ( req, res ) => {
	res.render( 'notice', { notice: req.model } );
} ) );

app.post( '/:id', hasNewModel(NoticeRepository, 'id'), wrapAsync( async ( req, res ) => {
	const notice = req.model as Notice;
	const noticeRepository = getCustomRepository(NoticeRepository);

	switch ( req.body.action ) {
	case 'update':
		await noticeRepository.update(notice.id, schemaToNotice(req.body));
		req.flash( 'success', 'notices-updated' );
		res.redirect( '/tools/notices/' + notice.id );
		break;

	case 'delete':
		await noticeRepository.delete(notice);
		req.flash( 'success', 'notices-deleted' );
		res.redirect( '/tools/notices' );
		break;
	}

} ) );

module.exports = config => {
	app_config = config;
	return app;
};

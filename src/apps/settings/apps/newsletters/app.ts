import express from 'express';
import moment from 'moment';

import { isSuperAdmin } from '@core/middleware';
import { wrapAsync } from '@core/utils';

import OptionsService from '@core/services/OptionsService';

import config from '@config';

const app = express();

app.set( 'views', __dirname + '/views' );

app.use(isSuperAdmin);

app.get('/', (req, res) => {
	res.render('index', {provider: config.newsletter.provider});
});

app.post('/', wrapAsync(async (req, res) => {
	if (req.body.action === 'resync') {
		req.flash('success', 'newsletter-resync-started');
		res.redirect(req.originalUrl);

		await OptionsService.set('newsletter-resync-status', 'Resync started at ' + moment.utc().format('hh:mm'));
	}
}));

export default app;

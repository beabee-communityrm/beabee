import express from 'express';

import { isSuperAdmin } from '@core/middleware';
import { wrapAsync } from '@core/utils';

import EmailService from '@core/services/EmailService';
import OptionsService from '@core/services/OptionsService';

import config from '@config';

const app = express();

app.set( 'views', __dirname + '/views' );

app.use(isSuperAdmin);

app.get('/', wrapAsync(async (req, res) => {
	res.render('index', {
		emailProvider: config.email.provider,
		emailTemplates: EmailService.emailTemplateIds,
		providerTemplates: await EmailService.getTemplates(),
		providerTemplateMap: EmailService.providerTemplateMap
	});
}));

app.post('/', wrapAsync(async (req, res) => {
	await OptionsService.set('email-templates', JSON.stringify(req.body.providerTemplates));
	req.flash('success', 'emails-templates-updated');
	res.redirect(req.originalUrl);
}));

export default app;

import express from 'express';

import auth from '@core/authentication';
import { wrapAsync } from '@core/utils';

import EmailService from '@core/services/EmailService';

import config from '@config';
import OptionsService from '@core/services/OptionsService';

const app = express();

app.set( 'views', __dirname + '/views' );

app.use(auth.isSuperAdmin);

app.get('/', wrapAsync(async (req, res) => {
	console.log(EmailService.providerTemplateMap);
	res.render('index', {
		emailProvider: config.email.provider,
		emailTemplates: EmailService.emailTemplateIds,
		providerTemplates: await EmailService.getTemplates(),
		providerTemplateMap: EmailService.providerTemplateMap
	});
}));

app.post('/', wrapAsync(async (req, res) => {
	await OptionsService.set('email-templates', JSON.stringify(req.body.providerTemplates));
	req.flash('success', 'email-templates-updated');
	res.redirect(req.originalUrl);
}));

export default app;

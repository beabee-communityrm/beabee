import busboy from 'connect-busboy';
import express from 'express';
import _ from 'lodash';
import Papa from 'papaparse';
import { getRepository } from 'typeorm';

import auth from '@core/authentication';
import mandrill from '@core/mandrill';
import { hasNewModel2 } from '@core/middleware';
import { AppConfig, wrapAsync } from '@core/utils';

import Email from '@models/Email';
import EmailMailing, { EmailRecipient } from '@models/EmailMailing';

const app = express();
let app_config: AppConfig;

function schemaToEmail(data): Email {
	const email = new Email();
	email.name = data.name;
	email.fromName = data.fromName;
	email.fromEmail = data.fromEmail;
	email.subject = data.subject;
	email.body = data.body;

	return email;
}

app.set( 'views', __dirname + '/views' );

app.use( auth.isAdmin );

app.use( function( req, res, next ) {
	res.locals.app = app_config;
	res.locals.breadcrumb.push( {
		name: app_config.title,
		url: app.mountpath
	} );
	next();
} );

app.get('/', wrapAsync(async (req, res) => {
	const emails = await getRepository(Email).find();
	res.render('index', {emails});
}));

app.post('/', wrapAsync(async (req, res) => {
	const emails = await getRepository(Email).save(schemaToEmail(req.body));
	res.redirect('/tools/emails/' + emails.id);
}));


app.get('/:id', hasNewModel2(Email, 'id'), wrapAsync(async (req, res) => {
	const mailings = await getRepository(EmailMailing).find({
		email: req.model
	});

	res.render('email', {email: req.model, mailings});
}));

app.post('/:id', hasNewModel2(Email, 'id'), wrapAsync(async (req, res) => {
	const email = req.model as Email;

	switch (req.body.action) {
	case 'update':
		await getRepository(Email).update(email.id, schemaToEmail(req.body));
		req.flash('success', 'transactional-email-updated');
		res.redirect(req.originalUrl);
		break;
	case 'delete':
		await getRepository(Email).delete(email.id);
		req.flash('success', 'transactional-email-deleted');
		res.redirect('/tools/emails');
		break;
	}
}));

app.post('/:id/mailings', hasNewModel2(Email, 'id'), busboy(), (req, res) => {
	const email = req.model as Email;
	let recipients: EmailRecipient[];

	req.busboy.on('file', (fieldname, file) => {
		Papa.parse(file, {
			header: true,
			complete: function (results) {
				recipients = results.data;
			}
		});
	});
	req.busboy.on('finish', async () => {
		const mailing = new EmailMailing();
		mailing.email = email;
		mailing.recipients = recipients;
		const savedMailing = await getRepository(EmailMailing).save(mailing);
		res.redirect(`/tools/emails/${email.id}/mailings/${savedMailing.id}`);
	});

	req.pipe(req.busboy);
});

app.get('/:id/mailings/:mailingId', hasNewModel2(Email, 'id'), wrapAsync(async (req, res) => {
	const email = req.model as Email;
	const mailing = await getRepository(EmailMailing).findOne(req.params.mailingId);
	const mergeFields = _.uniq(email.body.match(/\*\|[^|]+\|\*/g).map(f => f.substring(2, f.length - 2)));
	res.render('mailing', {
		email,
		mailing,
		mergeFields,
		headers: Object.keys(mailing.recipients[0])
	});
}));

interface SendSchema {
	emailField: string,
	nameField: string,
	mergeFields: Record<string, string>
}

app.post('/:id/mailings/:mailingId', hasNewModel2(Email, 'id'), wrapAsync(async (req, res) => {
	const email = req.model as Email;
	const mailing = await getRepository(EmailMailing).findOne(req.params.mailingId);

	const {emailField, nameField, mergeFields}: SendSchema = req.body;

	const message = {
		to: mailing.recipients.map(recipient => ({
			email: recipient[emailField],
			name: recipient[nameField]
		})),
		merge_vars: mailing.recipients.map(recipient => ({
			rcpt: recipient[emailField],
			vars: _.map(mergeFields, (value, key) => ({
				name: key,
				content: recipient[value]
			}))
		}))
	};

	await mandrill.send({
		from_email: email.fromEmail,
		from_name: email.fromName,
		html: email.body.replace(/\r\n/g, '<br/>'),
		auto_text: true,
		subject: email.subject,
		...message
	});

	await getRepository(EmailMailing).update(mailing.id, {
		sentDate: new Date(),
		emailField,
		nameField,
		mergeFields
	});

	res.redirect(req.originalUrl);
}));

export default (config: AppConfig): express.Express => {
	app_config = config;
	return app;
};

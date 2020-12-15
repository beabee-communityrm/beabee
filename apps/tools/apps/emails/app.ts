import express from 'express';
import busboy from 'connect-busboy';
import Papa from 'papaparse';

import auth from '@core/authentication';
import mandrill from '@core/mandrill';
import { hasModel, hasNewModel, hasNewModel2 } from '@core/middleware';
import { wrapAsync } from '@core/utils';

import TransactionalEmail from '@models/TransactionalEmail';
import { getRepository } from 'typeorm';
import TransactionalEmailSend, { TransactionalEmailRecipient } from '@models/TransactionalEmailSend';
import _ from 'lodash';

const app = express();
let app_config;

function schemaToTransactionalEmail(data): TransactionalEmail {
	const transactionalEmail = new TransactionalEmail();
	transactionalEmail.name = data.name;
	transactionalEmail.fromName = data.fromName;
	transactionalEmail.fromEmail = data.fromEmail;
	transactionalEmail.subject = data.subject;
	transactionalEmail.body = data.body;

	return transactionalEmail;
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
	const transactionalEmails = await getRepository(TransactionalEmail).find();
	res.render('index', {transactionalEmails});
}));

app.post('/', wrapAsync(async (req, res) => {
	const transactionalEmail = await getRepository(TransactionalEmail).save(schemaToTransactionalEmail(req.body));
	res.redirect('/tools/emails/' + transactionalEmail.id);
}));


app.get('/:id', hasNewModel2(TransactionalEmail, 'id'), wrapAsync(async (req, res) => {
	const sends = await getRepository(TransactionalEmailSend).find({
		parent: req.model
	});

	res.render('email', {email: req.model, sends});
}));

app.post('/:id', hasNewModel2(TransactionalEmail, 'id'), wrapAsync(async (req, res) => {
	const transactionalEmail = req.model as TransactionalEmail;

	switch (req.body.action) {
	case 'update':
		await getRepository(TransactionalEmail).update(transactionalEmail.id, schemaToTransactionalEmail(req.body));
		req.flash('success', 'transactional-email-updated');
		res.redirect(req.originalUrl);
		break;
	case 'delete':
		await getRepository(TransactionalEmail).delete(transactionalEmail.id);
		req.flash('success', 'transactional-email-deleted');
		res.redirect('/tools/emails');
		break;
	}
}));

app.post('/:id/send', hasNewModel2(TransactionalEmail, 'id'), busboy(), (req, res) => {
	const transactionalEmail = req.model as TransactionalEmail;
	let recipients: TransactionalEmailRecipient[];

	req.busboy.on('file', (fieldname, file) => {
		Papa.parse(file, {
			header: true,
			complete: function (results) {
				recipients = results.data;
			}
		});
	});
	req.busboy.on('finish', async () => {
		const transactionalEmailSend = new TransactionalEmailSend();
		transactionalEmailSend.parent = transactionalEmail;
		transactionalEmailSend.recipients = recipients;
		const saved = await getRepository(TransactionalEmailSend).save(transactionalEmailSend);
		res.redirect(`/tools/emails/${transactionalEmail.id}/send/${saved.id}`);
	});

	req.pipe(req.busboy);
});

app.get('/:id/send/:sendId', hasNewModel2(TransactionalEmail, 'id'), wrapAsync(async (req, res) => {
	const transactionalEmail = req.model as TransactionalEmail;
	const send = await getRepository(TransactionalEmailSend).findOne(req.params.sendId);
	const mergeFields = transactionalEmail.body.match(/\*\|[^|]+\|\*/g).map(f => f.substring(2, f.length - 2));
	res.render('send', {
		email: req.model,
		send,
		mergeFields,
		headers: Object.keys(send.recipients[0])
	});
}));

interface SendSchema {
	emailField: string,
	nameField: string,
	mergeFields: Record<string, string>
}

app.post('/:id/send/:sendId', hasNewModel2(TransactionalEmail, 'id'), wrapAsync(async (req, res) => {
	const email = req.model as TransactionalEmail;
	const send = await getRepository(TransactionalEmailSend).findOne(req.params.sendId);

	const {emailField, nameField, mergeFields}: SendSchema = req.body;

	const message = {
		to: send.recipients.map(recipient => ({
			email: recipient[emailField],
			name: recipient[nameField]
		})),
		merge_vars: send.recipients.map(recipient => ({
			rcpt: recipient[emailField],
			vars: _.map(mergeFields).map((value, key) => ({
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

	//await getRepository(TransactionalEmailSend).update(send.id, {sentDate: new Date()});

	res.redirect(req.originalUrl);
}));

export default (config): express.Express => {
	app_config = config;
	return app;
};

const express = require( 'express' );
const busboy = require( 'connect-busboy' );
const Papa = require('papaparse');

const auth = require( '@core/authentication' );
const { TransactionalEmails } = require( '@core/database' );
const mandrill = require( '@core/mandrill' );
const { hasModel } = require( '@core/middleware' );
const { wrapAsync } = require( '@core/utils' );

const app = express();

var app_config = {};

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
	const transactionalEmails = await TransactionalEmails.aggregate([
		{$project: {
			name: 1,
			created: 1,
			sent: 1,
			numberOfRecipients: {$size: '$recipients'}
		}}
	]);
	console.log(transactionalEmails);

	res.render('index', {transactionalEmails});
}));

app.post('/', busboy(), (req, res) => {
	let name, recipients;
	req.busboy.on('file', (fieldname, file) => {
		Papa.parse(file, {
			header: true,
			complete: function (results) {
				recipients = results.data;
			}
		});
	});

	req.busboy.on('field', (fieldname, value) => {
		if (fieldname === 'name') {
			name = value;
		}
	});
	
	req.busboy.on('finish', async () => {
		const transactionalEmail = await TransactionalEmails.create({
			name,
			recipients
		});
		req.flash('success', 'transactional-email-created');
		res.redirect('/tools/emails/' + transactionalEmail._id);
	});

	req.pipe(req.busboy);
});

app.get('/:_id', hasModel(TransactionalEmails, '_id'), wrapAsync(async (req, res) => {
	const templates = await mandrill.listTemplates();
	res.render('email', {
		transactionalEmail: req.model,
		fields: req.model.recipients.length > 0 ? Object.keys(req.model.recipients[0]) : {},
		templates
	});
}));

app.post('/:_id', hasModel(TransactionalEmails, '_id'), wrapAsync(async (req, res) => {
	const { action, emailField, nameField, mergeKeys, mergeFields, template } = req.body;

	if (action === 'send') {
		const mergeVars = mergeKeys
			.map((key, i) => ({key, field: mergeFields[i]}))
			.filter(({key}) => !!key);

		const message = {
			to: req.model.recipients.map(recipient => ({
				email: recipient[emailField],
				name: recipient[nameField]
			})),
			merge_vars: req.model.recipients.map(recipient => {
				return {
					rcpt: recipient[emailField],
					vars: mergeVars.map(({key, field}) => ({
						name: key,
						content: recipient[field]
					}))
				};
			})
		};

		if (template === '__custom__') {
			const {fromEmail, fromName, content, subject} = req.body;
			await mandrill.send({
				from_email: fromEmail,
				from_name: fromName,
				html: content.replace(/\r\n/g, '<br/>'),
				auto_text: true,
				subject,
				...message
			});
		} else {
			await mandrill.sendTemplate(template, message);
		}
		await req.model.update({$set: {sent: new Date()}});

		req.flash('success', 'transactional-email-sending');
		res.redirect('/tools/emails/' + req.model._id);
	} else if (action === 'delete') {
		await req.model.delete();
		req.flash('success', 'transactional-email-deleted');
		res.redirect('/tools/emails');
	}
}));


module.exports = function( config ) {
	app_config = config;
	return app;
};

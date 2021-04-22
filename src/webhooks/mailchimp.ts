import bodyParser from 'body-parser';
import express from 'express';

import config from '@config';

const app = express();

interface MailchimpPayload {
	type: 'subscribe'|'unsubscribe'
	data: any
}

app.use((req, res, next) => {
	if (req.query['secret'] === (config.newsletter.settings as any).webhook_secret) {
		next();
	} else {
		res.sendStatus(404);
	}
});

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));

app.get('/', (req, res) => {
	res.sendStatus(200);
});

app.post('/', (req, res) => {
	const {type, data} = req.body as MailchimpPayload;
	switch (type) {
	case 'subscribe':
	case 'unsubscribe':
	}
	res.sendStatus(200);
});

export default app;

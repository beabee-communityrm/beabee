import bodyParser from 'body-parser';
import express from 'express';
import { getRepository } from 'typeorm';

import { log as mainLogger } from '@core/logging';
import { ContributionType, wrapAsync } from '@core/utils';

import Member from '@models/Member';

import config from '@config';
import MembersService from '@core/services/MembersService';

const log = mainLogger.child({app: 'webhook-mailchimp'});

const app = express();

interface MCProfileData {
	email: string
	merges: {
		FNAME: string
		LNAME: string
		[key: string]: string
	}
}

interface MCUpdateEmailData {
	new_email: string
	old_email: string
}

interface MCProfileWebhook {
	type: 'subscribe'|'unsubscribe'|'profile'
	data: MCProfileData
}

interface MCUpdateEmailWebhook {
	type: 'upemail'
	data: MCUpdateEmailData
}

type MCWebhook = MCProfileWebhook|MCUpdateEmailWebhook;

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

app.post('/', wrapAsync(async (req, res) => {
	const body = req.body as MCWebhook;

	switch (body.type) {
	case 'upemail':
		await handleUpdateEmail(body.data);
		break;

	case 'subscribe':
		await handleSubscribe(body.data);
		break;

	case 'profile':
		if (!await handleUpdateProfile(body.data)) {
			return res.sendStatus(404);
		}
		break;
	}

	res.sendStatus(200);
}));

async function handleUpdateEmail(data: MCUpdateEmailData) {
	log.info({
		action: 'update-email',
		data: {
			oldEmail: data.old_email,
			newEmail: data.new_email
		}
	});

	await getRepository(Member).update({email: data.old_email}, {email: data.new_email});
}

async function handleSubscribe(data: MCProfileData) {
	const member = await MembersService.createMember({
		email: data.email,
		firstname: data.merges.FNAME,
		lastname: data.merges.LNAME,
		contributionType: ContributionType.None
	}, {
		deliveryOptIn: false
	});
}

async function handleUpdateProfile(data: MCProfileData): Promise<boolean> {
	log.info({
		action: 'update-profile',
		data: {email: data.email}
	});
	const member = await getRepository(Member).findOne({email: data.email});
	if (member) {
		await MembersService.updateMember(member, {
			email: data.email,
			firstname: data.merges.FNAME,
			lastname: data.merges.LNAME
		});
		return true;
	} else {
		log.info({
			action: 'update-profile-not-found'
		});
		return false;
	}
}

export default app;

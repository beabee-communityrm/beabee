import express from 'express';
import DiscourseSSO from 'discourse-sso';
import { getRepository } from 'typeorm';

import config from '@config';

import { isLoggedIn } from '@core/middleware';
import { hasUser, wrapAsync } from '@core/utils';

import ProjectMember from '@models/ProjectMember';

const sso = new DiscourseSSO( config.discourse.sso_secret );

const app = express();

app.use(isLoggedIn);

app.get( '/sso', wrapAsync(hasUser(async ( req, res ) => {
	const { sso: payload, sig } = req.query;

	if (payload && sig && sso.validate(payload as string, sig as string)) {
		const projectMemberships = await getRepository(ProjectMember).find({
			where: {memberId: req.user.id},
			relations: ['project']
		});

		const groups = projectMemberships
			.map(pm => pm.project.groupName)
			.filter((g): g is string => !!g);

		const nonce = sso.getNonce(payload as string);
		const loginPayload = {
			nonce,
			email: req.user.email,
			external_id: req.user.uuid,
			name: req.user.fullname,
			username: req.user.email,
			add_groups: groups
		};
		const q = sso.buildLoginString(loginPayload);
		res.redirect(`${config.discourse.url}/session/sso_login?${q}`);
	} else {
		res.status(403).send({error: 'Invalid signature'});
	}
} ) ) );

module.exports = app;

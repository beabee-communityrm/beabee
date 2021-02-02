import express from 'express';
import _ from 'lodash';
import moment from 'moment';
import { getRepository } from 'typeorm';

import auth from '@core/authentication';
import { hasNewModel, hasSchema } from '@core/middleware';
import { wrapAsync } from '@core/utils';

import Project from '@models/Project';
import { Members } from '@core/database';

import { createProjectSchema } from './schemas.json';
import ProjectMember from '@models/ProjectMember';
import ProjectEngagement from '@models/ProjectEngagement';

interface CreateProjectSchema {
	title: string
	description: string
	status: string
}

const app = express();

function schemaToProject( data: CreateProjectSchema ): Partial<Project> {
	const { title, description, status } = data;
	return { title, description, status };
}

function schemaToEngagement( data ) {
	const { type, date, time, notes } = data;
	return {
		type, notes,
		date: moment(`${date}T${time}`)
	};
}

app.set( 'views', __dirname + '/views' );

app.use( auth.isAdmin );

app.get( '/', wrapAsync( async ( req, res ) => {
	const projects = await getRepository(Project).find();
	res.render( 'index', { projects } );
} ) );

app.post( '/', hasSchema(createProjectSchema).orFlash, wrapAsync( async ( req, res ) => {
	const project = await getRepository(Project).create( {
		...schemaToProject( req.body ),
		ownerId: req.user?.id
	} );
	req.flash( 'success', 'project-created' );
	res.redirect( '/projects/' + project.id);
} ) );

app.get( '/:id', hasNewModel(Project, 'id'), wrapAsync( async ( req, res ) => {
	const project = req.model as Project;
	
	const projectMembers = await getRepository(ProjectMember).find({project});
	const engagements = await getRepository(ProjectEngagement).find({project});

	// TODO: remove when members is in ORM
	const members = await Members.find({id: {$in: [
		project.ownerId,
		...projectMembers.map(m => m.memberId),
		...engagements.map(m => m.member1Id),
		...engagements.map(m => m.member2Id)
	]}});

	const engagementsWithMember = engagements.map(e => ({
		...e,
		member1: members.find(m => m.id === e.member1Id),
		member2: members.find(m => m.id === e.member2Id)
	}))

	const projectMembersWithEngagement = projectMembers.map(pm => {
		const memberEngagements = engagementsWithMember.filter(e => pm.memberId === e.member2Id);
		return {
			...pm,
			member: members.find(m => m.id === pm.memberId),
			engagements: memberEngagements,
			engagementsByDate: _.sortBy(memberEngagements, 'date'),
			latestEngagement: memberEngagements[memberEngagements.length - 1]
		};
	});

	res.render( 'project', {
		project: {...project, owner: members.find(m => m.id === project.ownerId)},
		projectMembers: projectMembersWithEngagement
	} );
} ) );

app.post( '/:id', hasNewModel(Project, 'id'), wrapAsync( async ( req, res ) => {
	const project = req.model as Project;
	switch ( req.body.action ) {
	case 'update':
		await getRepository(Project).update(project.id, schemaToProject(req.body));
		req.flash( 'success', 'project-updated' );
		res.redirect( req.originalUrl );
		break;
	case 'add-members':
		await getRepository(ProjectMember).insert((req.body.members as string[]).map(memberId => ({
			project, memberId,
		})));
		req.flash( 'success', 'project-members-added' );
		res.redirect( req.originalUrl );
		break;
	case 'update-member-tag':
		await getRepository(ProjectMember).update( req.body.pmId, { tag: req.body.tag } );
		res.redirect( req.originalUrl + '#members' );
		break;
	case 'add-member-engagement':
		await ProjectMembers.updateOne( { _id: req.body.pmId }, {
			$push: { engagement: {
				...schemaToEngagement( req.body ),
				member: req.user
			} }
		} );
		res.redirect( req.originalUrl + '#members' );
		break;
	case 'delete-member-engagement':
		await ProjectMembers.updateOne( { _id: req.body.pmId }, {
			$pull: { engagement: {
				_id: req.body.eId
			} }
		} );
		res.redirect( req.originalUrl + '#members' );
		break;
	case 'delete':
		await getRepository(ProjectEngagement).delete( { project } );
		await getRepository(ProjectMember).delete( { project } );
		await getRepository(Project).delete(project.id);
		req.flash( 'success', 'project-deleted' );
		res.redirect( '/projects' );
		break;
	}
} ) );

export default app;

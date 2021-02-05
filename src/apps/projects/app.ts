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

interface CreateEngagementSchema {
	type: string
	date: string
	time: string
	notes: string
	memberId: string
}

interface UpdateProjectAction extends CreateProjectSchema {
	action: 'update'
}

interface AddMembersAction {
	action: 'add-members'
	memberIds: string[]
}

interface UpdateMemberTagAction {
	action: 'update-member-tag'
	projectMemberId: string
	tag: string
}

interface AddMemberEngagementAction extends CreateEngagementSchema {
	action: 'add-member-engagement'
}

interface DeleteMemberEngagementAction {
	action: 'delete-member-engagement'
	projectEngagementId: string
}

interface DeleteProjectAction {
	action: 'delete'
}

type UpdateAction = UpdateProjectAction|AddMembersAction|UpdateMemberTagAction|AddMemberEngagementAction|DeleteMemberEngagementAction|DeleteProjectAction;

function schemaToProject( data: CreateProjectSchema ): Pick<Project,'title'|'description'|'status'> {
	const { title, description, status } = data;
	return { title, description, status };
}

function schemaToEngagement( data: CreateEngagementSchema ): Pick<ProjectEngagement,'type'|'notes'|'date'|'toMemberId'> {
	const { type, date, time, notes } = data;
	return {
		type, notes,
		date: moment(`${date}T${time}`).toDate(),
		toMemberId: data.memberId
	};
}

const app = express();

app.set( 'views', __dirname + '/views' );

app.use( auth.isAdmin );

app.get( '/', wrapAsync( async ( req, res ) => {
	const projects = await getRepository(Project).find();
	res.render( 'index', { projects } );
} ) );

app.post( '/', hasSchema(createProjectSchema).orFlash, wrapAsync( async ( req, res ) => {
	const project = await getRepository(Project).save( {
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
	const members = await Members.find({_id: {$in: [
		project.ownerId,
		...projectMembers.map(m => m.memberId),
		...engagements.map(m => m.byMemberId),
		...engagements.map(m => m.toMemberId)
	]}});

	const engagementsWithMember = engagements.map(e => ({
		...e,
		byMember: members.find(m => m.id === e.byMemberId),
		toMember: members.find(m => m.id === e.toMemberId)
	}));

	const projectMembersWithEngagement = projectMembers.map(pm => {
		const memberEngagements = engagementsWithMember.filter(e => pm.memberId === e.toMemberId);
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
	const data = req.body as UpdateAction;
	const project = req.model as Project;

	console.log('here');

	switch ( data.action ) {
	case 'update':
		await getRepository(Project).update(project.id, schemaToProject(data));
		req.flash( 'success', 'project-updated' );
		res.redirect( req.originalUrl );
		break;
	case 'add-members':
		await getRepository(ProjectMember).insert(data.memberIds.map(memberId => ({
			project, memberId
		})));
		req.flash( 'success', 'project-members-added' );
		res.redirect( req.originalUrl );
		break;
	case 'update-member-tag':
		await getRepository(ProjectMember).update( data.projectMemberId, { tag: data.tag } );
		res.redirect( req.originalUrl + '#members' );
		break;
	case 'add-member-engagement':
		await getRepository(ProjectEngagement).insert({
			...schemaToEngagement(data),
			project,
			byMemberId: req.user?.id,
		});
		res.redirect( req.originalUrl + '#members' );
		break;
	case 'delete-member-engagement':
		await getRepository(ProjectEngagement).delete(data.projectEngagementId);
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

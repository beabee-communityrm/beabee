import express from 'express';
import _ from 'lodash';
import moment from 'moment';
import { createQueryBuilder, getRepository } from 'typeorm';

import { hasNewModel, hasSchema, isAdmin } from '@core/middleware';
import { wrapAsync } from '@core/utils';

import Member from '@models/Member';
import Project from '@models/Project';
import ProjectMember from '@models/ProjectMember';
import ProjectEngagement from '@models/ProjectEngagement';

import { createProjectSchema } from './schemas.json';

interface CreateProjectSchema {
	title: string
	description: string
	status: string,
	groupName?: string
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

function schemaToProject( data: CreateProjectSchema ): Pick<Project,'title'|'description'|'status'|'groupName'> {
	const { title, description, status, groupName } = data;
	return { title, description, status, groupName };
}

function schemaToEngagement( data: CreateEngagementSchema ): Pick<ProjectEngagement,'type'|'notes'|'date'|'toMember'> {
	const { type, date, time, notes } = data;
	return {
		type, notes,
		date: moment(`${date}T${time}`).toDate(),
		toMember: {id: data.memberId} as Member
	};
}

const app = express();

app.set( 'views', __dirname + '/views' );

app.use( isAdmin );

app.get( '/', wrapAsync( async ( req, res ) => {
	const projects = await createQueryBuilder(Project, 'p')
		.loadRelationCountAndMap('p.memberCount', 'p.members')
		.getMany();

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

app.get( '/:id', hasNewModel(Project, 'id', {relations: ['owner']}), wrapAsync( async ( req, res ) => {
	const project = req.model as Project;
	
	const projectMembers = await getRepository(ProjectMember).find({
		where: {project},
		relations: ['member', 'member.profile']
	});
	const engagements = await getRepository(ProjectEngagement).find({
		where: {project},
		relations: ['byMember', 'toMember']
	});

	const projectMembersWithEngagement = projectMembers.map(pm => {
		const memberEngagements = engagements.filter(e => pm.member.id === e.toMember.id);
		return {
			...pm,
			engagements: memberEngagements,
			engagementsByDate: _.sortBy(memberEngagements, 'date'),
			latestEngagement: memberEngagements[memberEngagements.length - 1]
		};
	});

	res.render( 'project', {
		project,
		projectMembers: projectMembersWithEngagement
	} );
} ) );

app.post( '/:id', hasNewModel(Project, 'id'), wrapAsync( async ( req, res ) => {
	const data = req.body as UpdateAction;
	const project = req.model as Project;

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
			byMember: req.user,
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

import express, { Request } from 'express';
import queryString from 'query-string';
import { Brackets, createQueryBuilder, getRepository, MoreThan } from 'typeorm';

import { Members } from '@core/database';
import { isAdmin } from '@core/middleware';
import { wrapAsync } from '@core/utils';
import { parseRuleGroup, RuleGroup } from '@core/utils/rules';

import OptionsService from '@core/services/OptionsService';
import SegmentService from '@core/services/SegmentService';

import MemberPermission, { PermissionType } from '@models/MemberPermission';
import Project from '@models/Project';
import Segment from '@models/Segment';

const app = express();

app.set( 'views', __dirname + '/views' );

app.use( isAdmin );

function getAvailableTags() {
	return Promise.resolve(OptionsService.getText('available-tags').split(',').map(s => s.trim()));
}

function convertBasicSearch(query: Request['query']): RuleGroup|undefined {
	const search: RuleGroup = {
		condition: 'AND',
		rules: []
	};
	
	for (const field of ['firstname', 'lastname', 'email'] as const) {
		if (query[field]) {
			search.rules.push({
				id: field,
				field,
				type: 'string',
				operator: 'contains',
				value: query[field] as string
			});
		}
	}
	if ( query.tag ) {
		search.rules.push({
			id: 'hasTag',
			field: 'hasTag',
			type: 'string',
			operator: 'equal',
			value: query.tag as string
		});
	}

	return search.rules.length > 0 ? search : undefined;
}

function getSearchRuleGroup(query: Request['query']): RuleGroup|undefined {
	return query.type === 'basic' ? convertBasicSearch(query) :
		typeof query.rules === 'string' ?
			JSON.parse(query.rules) as RuleGroup : undefined;
}

app.get( '/', wrapAsync( async ( req, res ) => {
	const { query } = req;
	const availableTags = await getAvailableTags();

	const segment = query.segment ? await getRepository(Segment).findOne(query.segment as string) : undefined;
	const searchType = query.type || (segment ? 'advanced' : 'basic');
	const searchRuleGroup = getSearchRuleGroup(query) || segment && segment.ruleGroup;

	const filter = searchRuleGroup ? parseRuleGroup(searchRuleGroup) : {};

	// Hack to keep permission filter until it becomes a rule
	if (searchType === 'basic' && (query.permission || !query.show_inactive)) {
		const qb = createQueryBuilder(MemberPermission, 'mp');
		qb.where('TRUE');

		if (query.permission) {
			qb.andWhere('mp.permission = :permission', {permission: query.permission});
		}
		if (!query.show_inactive) {
			qb.andWhere(new Brackets(qb => {
				qb.where('mp.dateExpires IS NULL')
					.orWhere('mp.dateExpires >= :dateExpires', {dateExpires: new Date()});
			}));
		}

		const memberships = await qb.getMany();

		if (!filter.$and) filter.$and = [];
		filter.$and.push( { _id: { $in: memberships.map(p => p.memberId) } } );
	}
	
	const page = query.page ? Number( query.page ) : 1;
	const limit = query.limit ? Number( query.limit ) : 25;

	const total = await Members.count( filter );
	const members = await Members.find( filter ).limit( limit ).skip( limit * ( page - 1 ) ).sort( [ [ 'lastname', 1 ], [ 'firstname', 1 ] ] );

	const pages = [ ...Array( Math.ceil( total / limit ) ) ].map( ( v, page ) => ( {
		number: page + 1,
		path: '/members?' + queryString.stringify( { ...query, page: page + 1 } )
	} ) );

	const next = page + 1 <= pages.length ? pages[ page ] : null;
	const prev = page - 1 > 0 ? pages[ page - 2 ] : null;

	const pagination = {
		pages, page, prev, next,
		start: (page - 1) * limit + 1,
		end: Math.min(total, page * limit),
		total: pages.length
	};

	const addToProject = query.addToProject && await getRepository(Project).findOne( query.addToProject as string );

	res.render( 'index', {
		availableTags, members, pagination, total,
		segment,
		searchQuery: query,
		searchType,
		searchRuleGroup,
		addToProject
	} );
} ) );

app.post('/', wrapAsync(async (req, res) => {
	const searchRuleGroup = getSearchRuleGroup(req.query);
	if (searchRuleGroup) {
		if (req.body.action === 'save-segment') {
			const segment = await SegmentService.createSegment('Untitled segment', searchRuleGroup);
			res.redirect('/members/?segment=' + segment.id);
		} else if (req.body.action === 'update-segment' && req.query.segment) {
			const segmentId = req.query.segment as string;
			await getRepository(Segment).update(segmentId, {ruleGroup: searchRuleGroup});
			res.redirect('/members/?segment=' + segmentId);
		} else {
			res.redirect(req.originalUrl);
		}
	} else {
		req.flash('error', 'segment-no-rule-group');
		res.redirect(req.originalUrl);
	}
}));

export default app;

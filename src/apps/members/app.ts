import express, { Request } from 'express';
import queryString from 'query-string';

import auth from '@core/authentication';
import { Members, Permissions, Projects } from '@core/database';
import { wrapAsync } from '@core/utils';
import { parseRuleGroup, RuleGroup } from '@core/utils/rules';

import OptionsService from '@core/services/OptionsService';
import SegmentService from '@core/services/SegmentService';

const app = express();

app.set( 'views', __dirname + '/views' );

app.use( auth.isAdmin );

function getAvailableTags() {
	return Promise.resolve(OptionsService.getText('available-tags')?.split(',').map(s => s.trim()));
}

function convertBasicSearch(query: Request['query']): RuleGroup|undefined {
	const search: RuleGroup = {
		condition: 'AND',
		rules: []
	};
	
	for (const field of ['firstname', 'lastname', 'email'] as const) {
		if (query[field]) {
			search.rules.push({
				field,
				type: 'string',
				operator: 'contains',
				value: query[field] as string
			});
		}
	}
	if ( query.tag ) {
		search.rules.push({
			field: 'hasTag',
			type: 'string',
			operator: 'equal',
			value: query.tag as string
		});
	}

	return search.rules.length > 0 ? search : undefined;
}

function getRuleGroup(query: Request['query']): RuleGroup|undefined {
	return query.type === 'basic' ? convertBasicSearch(query) :
		typeof query.query === 'string' ?
			JSON.parse(query.query) as RuleGroup : undefined;
}

app.get( '/', wrapAsync( async ( req, res ) => {
	const { query } = req;
	const permissions = await Permissions.find();
	const availableTags = await getAvailableTags();

	const searchType = query.type || 'basic';
	const page = query.page ? Number( query.page ) : 1;
	const limit = query.limit ? Number( query.limit ) : 25;

	const ruleGroup = getRuleGroup(query);
	const filter = ruleGroup ? parseRuleGroup(ruleGroup) : {};

	// Hack to keep permission filter until it becomes a rule
	if (query.permission || !query.show_inactive) {
		const permissionSearch = {
			...(query.permission && {
				permission: permissions.find(p => p.slug === query.permission)
			}),
			...(!query.show_inactive && {
				date_added: { $lte: new Date() },
				$or: [
					{ date_expires: null },
					{ date_expires: { $gt: new Date() } }
				]
			})
		};

		if (!filter.$and) filter.$and = [];
		filter.$and.push( { permissions: { $elemMatch: permissionSearch } } );
	}
	
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
		end: page * limit,
		total: pages.length
	};

	const addToProject = query.addToProject && await Projects.findById( query.addToProject );

	res.render( 'index', {
		permissions, availableTags, search: query,
		searchType, members, pagination, total,
		hasFilter: !!ruleGroup,
		addToProject
	} );
} ) );

app.post('/', wrapAsync(async (req, res) => {
	const ruleGroup = getRuleGroup(req.query);
	if (ruleGroup) {
		const segment = await SegmentService.createSegment('Untitled segment', ruleGroup);
		res.redirect('/members/segments/' + segment.id);
	} else {
		req.flash('error', 'segment-no-rule-group');
		res.redirect(req.originalUrl);
	}
}));

export default app;

import escapeStringRegexp from 'escape-string-regexp';
import express, { Request } from 'express';
import queryString from 'query-string';

import auth from '@core/authentication';
import { Members, Permissions, Projects } from '@core/database';
import { wrapAsync } from '@core/utils';

import OptionsService from '@core/services/OptionsService';
import { Permission } from '@models/permissions';
import { Member } from '@models/members';
import { FilterQuery } from 'mongoose';
import moment, { DurationInputArg2 } from 'moment';

const app = express();

app.set( 'views', __dirname + '/views' );

app.use( auth.isAdmin );

function fuzzyMatch(s: string) {
	return new RegExp( '.*' + escapeStringRegexp( s.trim() ) + '.*', 'i' );
}

function getAvailableTags() {
	return Promise.resolve(OptionsService.getText('available-tags')?.split(',').map(s => s.trim()));
}

function parseBasicSearch(query: Request['query'], permissions: Permission[]): FilterQuery<Member> {
	const search = [];

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

		search.push( { permissions: { $elemMatch: permissionSearch } } );
	}

	if ( query.firstname ) {
		search.push( { firstname:  fuzzyMatch( query.firstname as string ) } );
	}
	if ( query.lastname ) {
		search.push( { lastname: fuzzyMatch( query.lastname as string ) } );
	}
	if ( query.email ) {
		search.push( { email: fuzzyMatch( query.email as string ) } );
	}
	if ( query.tag ) {
		search.push( { tags: { $elemMatch: { name: query.tag } } } );
	}

	return search.length > 0 ? { $and: search } : {};

}

const operators = {
	equal: (v: RichRuleValue[]) => ( v[0] ),
	not_equal: (v: RichRuleValue[]) => ( { '$ne': v[0] } ),
	in: (v: RichRuleValue[]) => ( { '$in': v } ),
	not_in: (v: RichRuleValue[]) => ( { '$nin': v } ),
	less: (v: RichRuleValue[]) => ( { '$lt': v[0] } ),
	less_or_equal: (v: RichRuleValue[]) => ( { '$lte': v[0] } ),
	greater: (v: RichRuleValue[]) => ( { '$gt': v[0] } ),
	greater_or_equal: (v: RichRuleValue[]) => ( { '$gte': v[0] } ),
	between: (v: RichRuleValue[]) => ( { '$gte': v[0], '$lte': v[1] } ),
	not_between: (v: RichRuleValue[]) => ( { '$lt': v[0], '$gt': v[1] } ),
	begins_with: (v: RichRuleValue[]) => ( { '$regex': '^' + escapeStringRegexp(v[0] + '') } ),
	not_begins_with: (v: RichRuleValue[]) => ( { '$regex': '^(?!' + escapeStringRegexp(v[0] + '') + ')' } ),
	contains: (v: RichRuleValue[]) => ( { '$regex': escapeStringRegexp(v[0] + '') } ),
	not_contains: (v: RichRuleValue[]) => ( { '$regex': '^((?!' + escapeStringRegexp(v[0] + '') + ').)*$', '$options': 's' } ),
	ends_with: (v: RichRuleValue[]) => ( { '$regex': escapeStringRegexp(v[0] + '') + '$' } ),
	not_ends_with: (v: RichRuleValue[]) => ( { '$regex': '(?<!' + escapeStringRegexp(v[0] + '') + ')$' } ),
	is_empty: () => ( '' ),
	is_not_empty: () => ( { '$ne': '' } ),
	is_null: () => ( null ),
	is_not_null: () => ( { '$ne': null }  ),
} as const;

const fields = {
	'contributionMonthlyAmount': 'gocardless.amount',
	'contributionPeriod': 'gocardless.period',
	'deliveryOptIn': 'delivery_optin',
	'activeSubscription': 'gocardless.subscription_id',
	'dateAdded': 'permissions.0.date_added',
	'dateExpires': 'permissions.0.date_expires',
	'hasTag': 'tags.name'
} as const;

type RuleValue = string|number|boolean;
type RichRuleValue = RuleValue|Date;

interface Rule {
	field: keyof typeof fields
	type: 'string'|'integer'|'boolean'|'double'
	operator: keyof typeof operators
	value: RuleValue|RuleValue[]
}

interface RuleGroup {
	condition: 'AND'|'OR'
	rules: (Rule|RuleGroup)[]
}

function isRuleGroup(a: Rule|RuleGroup): a is RuleGroup {
	return 'condition' in a;
}

function parseValue(value: RuleValue): RichRuleValue {
	if (typeof value === 'string') {
		if (value.startsWith('$now')) {
			const date = moment.utc();
			const match = /\$now(\((?:(?:y|M|d|h|m|s):(?:-?\d+),?)+\))?/.exec(value);
			if (match && match[1]) {
				for (const modifier of match[1].matchAll(/(y|M|d|h|m|s):(-?\d+)/g)) {
					date.add(modifier[2], modifier[1] as DurationInputArg2);
				}
			}
			return date.toDate();
		}
		return value;
	} else {
		return value;
	}
}

function parseRule(rule: Rule): FilterQuery<Member> {
	const values = Array.isArray(rule.value) ? rule.value : [rule.value];
	return {
		[fields[rule.field]]: operators[rule.operator](values.map(parseValue))
	};
}

function parseRuleGroup(query: RuleGroup): FilterQuery<Member> {
	return {
		[query.condition === 'AND' ? '$and' : '$or']: query.rules.map(rule => (
			isRuleGroup(rule) ? parseRuleGroup(rule) : parseRule(rule)
		))
	};
}

app.get( '/', wrapAsync( async ( req, res ) => {
	const { query } = req;
	const permissions = await Permissions.find();
	const availableTags = await getAvailableTags();

	const searchType = query.type || 'basic';
	const page = query.page ? Number( query.page ) : 1;
	const limit = query.limit ? Number( query.limit ) : 25;

	const filter = searchType === 'basic' ?
		parseBasicSearch(query, permissions) :
		parseRuleGroup(JSON.parse(query.query as string));

	console.log(JSON.stringify(filter, null, 2));

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
		total: pages.length
	};

	const addToProject = query.addToProject && await Projects.findById( query.addToProject );

	res.render( 'index', {
		permissions, availableTags, search: query,
		searchType, members, pagination, total,
		count: members ? members.length : 0,
		addToProject
	} );
} ) );

export default app;

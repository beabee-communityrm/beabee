import escapeStringRegexp from 'escape-string-regexp';
import express, { Request } from 'express';
import queryString from 'query-string';

import auth from '@core/authentication';
import { Members, Permissions, Projects } from '@core/database';
import { wrapAsync } from '@core/utils';

import OptionsService from '@core/services/OptionsService';
import { Permission } from '@models/permissions';
import { Member } from '@models/members';

const app = express();

app.set( 'views', __dirname + '/views' );

app.use( auth.isAdmin );

function fuzzyMatch(s: string) {
	return new RegExp( '.*' + escapeStringRegexp( s.trim() ) + '.*', 'i' );
}

function getAvailableTags() {
	return Promise.resolve(OptionsService.getText('available-tags')?.split(',').map(s => s.trim()));
}

interface SearchResult {
	total: number
	members: Member[]
}

async function doBasicSearch(
	query: Request['query'],
	permissions: Permission[],
	page: number,
	limit: number
): Promise<SearchResult> {
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

	const filter = search.length > 0 ? { $and: search } : {};

	const total = await Members.count( filter );
	const members = await Members.find( filter ).limit( limit ).skip( limit * ( page - 1 ) ).sort( [ [ 'lastname', 1 ], [ 'firstname', 1 ] ] );

	return {total, members};
}

async function doAdvancedSearch(query: string): Promise<SearchResult> {
	const rules = JSON.parse(query);
	
	return {
		total: 0,
		members: []
	};
}

app.get( '/', wrapAsync( async ( req, res ) => {
	const { query } = req;
	const permissions = await Permissions.find();
	const availableTags = await getAvailableTags();

	const searchType = query.type || 'basic';
	const page = query.page ? Number( query.page ) : 1;
	const limit = query.limit ? Number( query.limit ) : 25;

	const {total, members} = searchType === 'basic' ?
		await doBasicSearch(query, permissions, page, limit) :
		await doAdvancedSearch(query.query as string);

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

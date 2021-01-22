const escapeStringRegexp = require( 'escape-string-regexp' );
const express = require( 'express' );
const queryString = require('query-string');

const auth = require( '@core/authentication' );
const { Members, Permissions, Projects } = require( '@core/database' );
const { wrapAsync } = require( '@core/utils' );

const { default: OptionsService } = require( '@core/services/OptionsService' );

const app = express();
var app_config = {};

app.set( 'views', __dirname + '/views' );

app.use( ( req, res, next ) => {
	res.locals.app = app_config;
	next();
} );

app.use( auth.isAdmin );

function fuzzyMatch(s) {
	return new RegExp( '.*' + escapeStringRegexp( s.trim() ) + '.*', 'i' );
}

function getAvailableTags() {
	return Promise.resolve(OptionsService.getText('available-tags').split(',').map(s => s.trim()));
}

app.get( '/', wrapAsync( async ( req, res ) => {
	const { query } = req;
	const permissions = await Permissions.find();
	const availableTags = await getAvailableTags();

	let search = [];

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
		search.push( { firstname:  fuzzyMatch( query.firstname ) } );
	}
	if ( query.lastname ) {
		search.push( { lastname: fuzzyMatch( query.lastname ) } );
	}
	if ( query.email ) {
		search.push( { email: fuzzyMatch( query.email ) } );
	}
	if ( query.tag ) {
		search.push( { tags: { $elemMatch: { name: query.tag } } } );
	}

	const filter = search.length > 0 ? { $and: search } : {};

	const total = await Members.count( filter );

	const limit = 25;
	const page = query.page ? parseInt( query.page ) : 1;

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

	const members = await Members.find( filter ).limit( limit ).skip( limit * ( page - 1 ) ).sort( [ [ 'lastname', 1 ], [ 'firstname', 1 ] ] );

	const addToProject = query.addToProject && await Projects.findById( query.addToProject );

	res.render( 'index', {
		permissions, availableTags, search: query,
		members, pagination, total,
		count: members ? members.length : 0,
		addToProject
	} );
} ) );

module.exports = ( config ) => {
	app_config = config;
	return app;
};

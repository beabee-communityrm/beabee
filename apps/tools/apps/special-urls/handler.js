const express = require( 'express' );
const _ = require( 'lodash' );
const moment = require( 'mongoose' );
const mongoose = require( 'mongoose' );

const { SpecialUrls } = require( __js + '/database' );
const mandrill = require( __js + '/mandrill' );
const { wrapAsync } = require( __js + '/utils' );

const actions = require( './actions' );
const { getSpecialUrlUrl } = require( './utils' );

const app = express();
app.set( 'views', __dirname + '/views' );

app.locals.basedir = __root;

const actionsByName = _(actions).map(action => [action.name, action]).fromPairs().valueOf();

async function hasValidSpecialUrl( req, res, next ) {
	let specialUrl;
	try {
		specialUrl = await SpecialUrls.findOne( {
			uuid: req.params.urlId, group: req.params.groupId
		} ).populate( 'group' );
	} catch ( err ) {
		if ( !( err instanceof mongoose.CastError ) ) {
			throw err;
		}
	}

	if ( !specialUrl ) {
		next('route');
		return;
	}

	if ( !specialUrl.group.active ) {
		res.render('expired');
		return;
	}

	if ( !specialUrl.active ) {
		const newSpecialUrl = await SpecialUrls.create( {
			email: specialUrl.email,
			group: specialUrl.group,
			firstname: specialUrl.firstname,
			lastname: specialUrl.lastname,
			actionParams: specialUrl.actionParams,
			expires: moment.utc().add(specialUrl.group.urlDuration, 'hours')
		} );

		await mandrill.sendMessage( 'expired-special-url-resend', {
			to: [{
				email: specialUrl.email,
				name: specialUrl.firstname + ' ' + specialUrl.lastname
			}],
			merge_vars: [{
				rcpt: specialUrl.email,
				vars: [
					{
						name: 'FNAME',
						content: specialUrl.firstname
					},
					{
						name: 'URL',
						content: getSpecialUrlUrl( newSpecialUrl )
					}
				]
			}]
		} );
		res.render( 'resend' );
		return;
	}

	const actions = _.zipWith(specialUrl.group.actions, specialUrl.actionParams, (action, actionParams) => ({
		name: action.name,
		params: {
			...action.params,
			...actionParams
		}
	}));

	const actionNo = req.params.actionNo || 0;
	const actionsComplete = req.session.actionsComplete || 0;
	if ( actionNo <= actionsComplete ) {
		req.specialUrl = specialUrl;
		req.specialUrlActions = actions;
		req.specialUrlActionNo = actionNo;
		next();
	} else {
		res.status(500).send('error');
	}
}

app.get( '/:groupId/:urlId/done', hasValidSpecialUrl, ( req, res ) => {
	res.render('done');
} );

app.all( '/:groupId/:urlId/:actionNo?', hasValidSpecialUrl, wrapAsync( async ( req, res ) => {
	const { specialUrl, specialUrlActions, specialUrlActionNo } = req;

	if ( !req.params.actionNo ) {
		await specialUrl.update( { $inc: { openCount: 1 } } );
	}

	for ( let i = specialUrlActionNo; i < specialUrlActions.length; i++ ) {
		const action = specialUrlActions[i];

		const doNextAction = await actionsByName[action.name].run(req, res, action.params);
		// Actions are expected to handle sending the user a response if they return false
		if (!doNextAction) {
			return;
		}

		req.session.actionsComplete = i;
	}

	await specialUrl.update( { $inc: { completedCount: 1 } } );
	res.redirect( `/s/${req.params.groupId}/${req.params.urlId}/done` );
} ) );

module.exports = app;

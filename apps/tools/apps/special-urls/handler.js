const express = require( 'express' );
const _ = require( 'lodash' );
const mongoose = require( 'mongoose' );

const { SpecialUrls } = require( __js + '/database' );
const { wrapAsync } = require( __js + '/utils' );

const actions = require('./actions');

const app = express();
app.set( 'views', __dirname + '/views' );

const actionsByName = _(actions).map(action => [action.name, action]).fromPairs().valueOf();

async function isValidSpecialUrl( req, res, next ) {
	let specialUrl;
	try {
		specialUrl = await SpecialUrls.findOne( {
			_id: req.params.urlId, group: req.params.groupId
		} ).populate( 'group' );
	} catch ( err ) {
		if ( !( err instanceof mongoose.CastError ) ) {
			throw err;
		}
	}

	if ( specialUrl ) {
		if ( specialUrl.group.active ) {
			const actions = _.zipWith(specialUrl.group.actions, specialUrl.actionParams, (action, actionParams) => {
				return {
					name: action.name,
					params: {
						...action.params,
						...actionParams
					}
				};
			});

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
		} else {
			res.send('Inactive link');
		}
	} else {
		next('route');
	}
}

app.get( '/:groupId/:urlId/done', isValidSpecialUrl, ( req, res ) => {
	res.send('done');
} );

app.all( '/:groupId/:urlId/:actionNo?', isValidSpecialUrl, wrapAsync( async ( req, res ) => {
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

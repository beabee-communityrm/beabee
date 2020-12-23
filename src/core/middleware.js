const mongoose = require( 'mongoose' );
const { getCustomRepository, getRepository } = require('typeorm');

const ajv = require('./ajv');

const Options = require( './options' )();
const config = require( '@config' );

function convertErrorsToMessages( errors ) {
	return errors
		.map( error => {
			switch ( error.keyword ) {
			case 'required':
				return `flash-validation-error${error.dataPath}.${error.params.missingProperty}-required`;
			case 'format':
				return `flash-validation-error.${error.params.format}-format`;
			default:
				return `flash-validation-error${error.dataPath}-${error.keyword}`;
			}
		} )
		.map( key => {
			return Options.getText( key ) ||
				(config.dev ? key : Options.getText('flash-validation-error-generic'));
		} )
	// Don't show duplicate errors twice
		.filter( ( value, index, arr ) => arr.indexOf( value ) === index );
}

function flashErrors( errors, req, res ) {
	convertErrorsToMessages( errors )
		.forEach( message => req.flash( 'danger', message ) );

	res.redirect( req.originalUrl );
}

function send400( errors, req, res ) {
	res.status(400).send( errors );
}

function redirectTo( url ) {
	return ( errors, req, res ) => {
		res.redirect( url );
	};
}

function replyWithJSON( errors, req, res ) {
	res.status(400).send( convertErrorsToMessages( errors ) );
}

function onRequest( validators, onErrors ) {
	return ( req, res, next ) => {
		const errors = Object.keys(validators).reduce( ( errors, key ) => {
			return validators[key]( req[key] ) ? [] : validators[key].errors;
		}, []);
		
		if ( errors.length > 0 ) {
			onErrors( errors, req, res, next );
		} else {
			next();
		}
	};
}

function hasSchema( schema ) {
	const validators = {};

	for ( let key in schema ) {
		validators[key] = ajv.compile( schema[key] );
	}

	return {
		or400: onRequest( validators, send400 ),
		orFlash: onRequest( validators, flashErrors ),
		orRedirect( url ) {
			return onRequest( validators, redirectTo( url ) );
		},
		orReplyWithJSON: onRequest( validators, replyWithJSON )
	};
}

function hasModel( model, prop ) {
	return async ( req, res, next ) => {
		// Avoid refetching models as they fall through handlers
		if (!req.model || req.model[prop] !== req.params[prop]) {
			try {
				req.model = await model.findOne( { [prop]: req.params[prop] } );
			} catch (err) {
				if (!(err instanceof mongoose.CastError)) {
					throw err;
				}
			}
		}

		if (req.model) {
			next();
		} else {
			next('route');
		}
	};
}

function hasNewModel(entityRespository, prop) {
	return async (req, res, next) => {
		if (!req.model || req.model[prop] !== req.params[prop]) {
			req.model = await getCustomRepository(entityRespository).findOne({where: {[prop]: req.params[prop]}});
		}
		if (req.model) {
			next();
		} else {
			next('route');
		}
	};
}

function hasNewModel2(entity, prop) {
	return async (req, res, next) => {
		if (!req.model || req.model[prop] !== req.params[prop]) {
			req.model = await getRepository(entity).findOne({where: {[prop]: req.params[prop]}});
		}
		if (req.model) {
			next();
		} else {
			next('route');
		}
	};
}

module.exports = {
	hasSchema,
	hasModel,
	hasNewModel,
	hasNewModel2
};

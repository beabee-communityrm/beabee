import { ErrorObject, FormatParams, RequiredParams, ValidateFunction } from 'ajv';
import { NextFunction, Request, RequestHandler, Response } from 'express';
import mongoose, { Document, DocumentDefinition, FilterQuery, Model } from 'mongoose';
import { EntityTarget, getCustomRepository, getRepository, ObjectType, Repository } from 'typeorm';

import ajv from '@core/ajv';
import OptionsService from'@core/services/OptionsService';

import config from '@config';

interface OnErrorHandler {
	(errors: ErrorObject[], req: Request, res: Response, next?: NextFunction): void
}

const validationKeys = ['body', 'query', 'params'] as const;
type ValidationKeys = typeof validationKeys extends readonly (infer U)[] ? U : never;

type Validators = Partial<Record<ValidationKeys, ValidateFunction>>;

interface HasSchema {
	or400: RequestHandler
	orFlash: RequestHandler
	orRedirect(url: string): RequestHandler
	orReplyWithJSON: RequestHandler
}

function convertErrorsToMessages(errors: ErrorObject[]): string[] {
	const genericErrorMessage = OptionsService.getText('flash-validation-error-generic') || '';
	return errors
		.map( error => {
			switch ( error.keyword ) {
			case 'required':
				return `flash-validation-error${error.dataPath}.${(error.params as RequiredParams).missingProperty}-required`;
			case 'format':
				return `flash-validation-error.${(error.params as FormatParams).format}-format`;
			default:
				return `flash-validation-error${error.dataPath}-${error.keyword}`;
			}
		} )
		.map( key => {
			return OptionsService.getText( key ) ||
				(config.dev ? key : genericErrorMessage);
		} )
	// Don't show duplicate errors twice
		.filter( ( value, index, arr ) => arr.indexOf( value ) === index );
}

const flashErrors: OnErrorHandler = (errors, req, res) => {
	convertErrorsToMessages( errors )
		.forEach( message => req.flash( 'danger', message ) );

	res.redirect( req.originalUrl );
};

const send400: OnErrorHandler = (errors, req, res) => {
	res.status(400).send(errors);
};

const redirectTo = ( url: string ): OnErrorHandler => (errors, req, res) => res.redirect(url);

const replyWithJSON: OnErrorHandler = (errors, req, res) => {
	res.status(400).send( convertErrorsToMessages( errors ) );
};

function onRequest( validators: Validators, onErrors: OnErrorHandler ): RequestHandler {
	return ( req, res, next ) => {
		const errors = validationKeys.map(key => {
			const validator = validators[key];
			return !validator || validator(req[key]) ? [] : validator.errors!;
		}).reduce((a, b) => [...a, ...b]);
		
		if ( errors.length > 0 ) {
			onErrors( errors, req, res, next );
		} else {
			next();
		}
	};
}

// eslint-disable-next-line @typescript-eslint/ban-types
export function hasSchema( schema: Partial<Record<ValidationKeys, object>>): HasSchema {
	const validators: Validators = {};

	for ( const key of validationKeys ) {
		const keySchema = schema[key];
		if (keySchema) {
			validators[key] = ajv.compile(keySchema);
		}
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

export function hasModel<T extends Document>(modelCls: Model<T>, prop: keyof DocumentDefinition<T>): RequestHandler {
	return async ( req, res, next ) => {
		// Avoid refetching models as they fall through handlers
		if (!req.model || (req.model as any)[prop] != req.params[prop as string]) {
			try {
				req.model = await modelCls.findOne( { [prop]: req.params[prop as string] } as FilterQuery<T> );
			} catch (err) {
				if (!(err instanceof mongoose.Error.CastError)) {
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

export function hasNewModel<T>(entity: EntityTarget<T>, prop: keyof T): RequestHandler {
	return async (req, res, next) => {
		if (!req.model || (req.model as any)[prop] !== req.params[prop as string]) {
			req.model = await getRepository(entity).findOne({where: {
				[prop]: req.params[prop as string]
			}});
		}
		if (req.model) {
			next();
		} else {
			next('route');
		}
	};
}

export function hasNewModel2<R extends Repository<T>, T>(entityRespository: ObjectType<R>, prop: keyof T): RequestHandler {
	return async (req, res, next) => {
		if (!req.model || (req.model as any)[prop] !== req.params[prop as string]) {
			req.model = await getCustomRepository(entityRespository).findOne({
				where: {[prop]: req.params[prop as string]}
			});
		}
		if (req.model) {
			next();
		} else {
			next('route');
		}
	};
}

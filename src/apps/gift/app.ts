import express from 'express';
import moment from 'moment';

import config from '@config';

import { GiftFlows, Members } from '@core/database';
import { hasModel, hasSchema } from '@core/middleware';
import stripe from '@core/stripe';
import { AppConfig, loginAndRedirect, wrapAsync } from '@core/utils';

import MembersService from '@core/services/MembersService';
import OptionsService from '@core/services/OptionsService';

import { processGiftFlow } from './utils';
import { createGiftSchema, updateGiftAddressSchema } from './schema.json';
import { GiftFlow } from '@models/gift-flows';

const app = express();
let app_config: AppConfig;

app.set( 'views', __dirname + '/views' );

app.use( function( req, res, next ) {
	res.locals.app = app_config;
	next();
} );

app.get( '/', ( req, res ) => {
	res.render( 'index', {stripePublicKey: config.stripe.public_key} );
} );

async function createGiftFlow(giftForm: GiftFlow['giftForm']): Promise<GiftFlow> {
	try {
		return await GiftFlows.create({
			sessionId: 'UNKNOWN',
			setupCode: MembersService.generateMemberCode(giftForm),
			giftForm
		});
	} catch (saveError) {
		const {code, message} = saveError;
		if (code === 11000 && message.indexOf('setupCode') > -1) {
			return await createGiftFlow(giftForm);
		}
		throw saveError;
	}
}

app.post( '/', hasSchema( createGiftSchema ).orReplyWithJSON, wrapAsync( async ( req, res ) => {
	let error;

	const startDate = moment(req.body.startDate).endOf('day');
	if (startDate.isBefore()) {
		error = 'flash-gifts-date-in-the-past';
	} else {
		const member = await Members.findOne({email: req.body.email});
		if (member) {
			error = 'flash-gifts-email-duplicate';
		}
	}

	if (error) {
		res.status(400).send([OptionsService.getText(error)]);
	} else {
		const giftFlow = await createGiftFlow(req.body);
		const isAnnual = req.body.type === '12';

		const session = await stripe.checkout.sessions.create({
			success_url: config.audience + '/gift/thanks/' + giftFlow._id,
			cancel_url: config.audience + '/gift',
			customer_email: req.body.fromEmail,
			payment_method_types: ['card'],
			line_items: [{
				name: 'Gift membership - ' + (isAnnual ? '12 months' : '6 months'),
				amount: isAnnual ? 3600 : 1800,
				currency: 'gbp',
				quantity: 1
			}]
		});

		await giftFlow.update({sessionId: session.id});

		res.send({sessionId: session.id});
	}
} ) );

app.get( '/:setupCode', hasModel(GiftFlows, 'setupCode'), wrapAsync( async ( req, res, next ) => {
	const giftFlow = req.model as GiftFlow;

	if (giftFlow.completed) {
		if (!giftFlow.processed) {
			await processGiftFlow(giftFlow, true);
		}

		const member = await Members.findOne({giftCode: req.params.setupCode});
		if (member) {
			// Effectively expire this link once the member is set up
			if (member.setupComplete) {
				res.redirect('/login');
			} else {
				loginAndRedirect(req, res, member);
			}
		} else {
			next('route');
		}
	} else {
		res.redirect('/gift/failed/' + giftFlow._id);
	}
} ) );

app.get( '/thanks/:_id', hasModel(GiftFlows, '_id'),  ( req, res ) => {
	const giftFlow = req.model as GiftFlow;
	if (giftFlow.completed) {
		res.render('thanks', {
			...giftFlow.giftForm,
			processed: giftFlow.processed
		});
	} else {
		res.redirect('/gift/failed/' + giftFlow._id);
	}
} );

app.post( '/thanks/:_id', [
	hasModel(GiftFlows, '_id'),
	hasSchema(updateGiftAddressSchema).orFlash
], wrapAsync( async ( req, res ) => {
	const giftFlow = req.model as GiftFlow;
	if (!giftFlow.processed && !giftFlow.giftForm.delivery_address?.line1) {
		const {delivery_address, same_address, delivery_copies_address} = req.body;
		await giftFlow.update({$set: {
			'giftForm.delivery_address': delivery_address,
			'giftForm.delivery_copies_address': same_address ? delivery_address : delivery_copies_address
		}});
	}

	res.redirect( req.originalUrl );
} ) );

app.get( '/failed/:_id', hasModel(GiftFlows, '_id'), ( req, res ) => {
	const giftFlow = req.model as GiftFlow;
	if (giftFlow.completed) {
		res.redirect('/gift/thanks/' + giftFlow._id);
	} else {
		res.render('failed', {id: giftFlow._id});
	}
} );

export default function ( config: AppConfig ): express.Express {
	app_config = config;
	return app;
}

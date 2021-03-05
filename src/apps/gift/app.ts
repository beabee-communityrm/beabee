import express from 'express';
import moment from 'moment';

import config from '@config';

import { Members } from '@core/database';
import { hasNewModel, hasSchema } from '@core/middleware';
import { loginAndRedirect, wrapAsync } from '@core/utils';

import GiftService from '@core/services/GiftService';
import OptionsService from '@core/services/OptionsService';

import GiftFlow, { Address, GiftForm } from '@models/GiftFlow';

import { createGiftSchema, updateGiftAddressSchema } from './schema.json';

const app = express();

interface CreateGiftSchema {
	firstname: string
	lastname: string
	email: string
	startDate: string
	message?: string
	fromName: string
	fromEmail: string
	months: number
}

interface AddressSchema {
	line1: string
	line2?: string
	city: string
	postcode: string
}

type UpdateGiftAddressSchema = {
	sameAddress: true
	giftAddress: AddressSchema
} | {
	sameAddress: false
	giftAddress: AddressSchema
	deliveryAddress: AddressSchema
}

function schemaToGiftForm(data: CreateGiftSchema): GiftForm {
	const giftForm = new GiftForm();
	giftForm.firstname = data.firstname;
	giftForm.lastname = data.lastname;
	giftForm.email = data.email;
	giftForm.startDate = moment.utc(data.startDate).toDate();
	giftForm.message = data.message;
	giftForm.fromName = data.fromName;
	giftForm.fromEmail = data.fromEmail;
	giftForm.months = data.months;
	return giftForm;
}

function schemaToAddress(data: AddressSchema): Address {
	return data;
}

function schemaToAddresses(data: UpdateGiftAddressSchema): {giftAddress: Address, deliveryAddress: Address} {
	const giftAddress = schemaToAddress(data.giftAddress);
	const deliveryAddress = data.sameAddress ? schemaToAddress(data.giftAddress) : schemaToAddress(data.deliveryAddress);
	return {giftAddress, deliveryAddress};
}

app.set( 'views', __dirname + '/views' );

app.get( '/', ( req, res ) => {
	res.render( 'index', {stripePublicKey: config.stripe.public_key} );
} );

app.post( '/', hasSchema( createGiftSchema ).orReplyWithJSON, wrapAsync( async ( req, res ) => {
	let error;
	const giftForm = schemaToGiftForm(req.body);

	if (moment(giftForm.startDate).isBefore(undefined, 'day')) {
		error = 'flash-gifts-date-in-the-past' as const;
	} else {
		const member = await Members.findOne({email: giftForm.email});
		if (member) {
			error = 'flash-gifts-email-duplicate' as const;
		}
	}

	if (error) {
		res.status(400).send([OptionsService.getText(error)]);
	} else {
		const sessionId = await GiftService.createGiftFlow(giftForm);
		res.send({sessionId});
	}
} ) );

app.get( '/:setupCode', hasNewModel(GiftFlow, 'setupCode'), wrapAsync( async ( req, res, next ) => {
	const giftFlow = req.model as GiftFlow;

	if (giftFlow.completed) {
		if (!giftFlow.processed) {
			await GiftService.processGiftFlow(giftFlow, true);
		}

		const member = await Members.findOne({giftCode: req.params.setupCode});
		if (member) {
			// Effectively expire this link once the member is set up
			if (member.setupComplete) {
				req.flash('warning', 'gifts-already-activated');
				res.redirect('/login');
			} else {
				loginAndRedirect(req, res, member, '/profile/complete');
			}
		} else {
			next('route');
		}
	} else {
		res.redirect('/gift/failed/' + giftFlow.id);
	}
} ) );

app.get( '/thanks/:id', hasNewModel(GiftFlow, 'id'),  ( req, res ) => {
	const giftFlow = req.model as GiftFlow;
	if (giftFlow.completed) {
		res.render('thanks', {
			...giftFlow.giftForm,
			processed: giftFlow.processed
		});
	} else {
		res.redirect('/gift/failed/' + giftFlow.id);
	}
} );

app.post( '/thanks/:id', [
	hasNewModel(GiftFlow, 'id'),
	hasSchema(updateGiftAddressSchema).orFlash
], wrapAsync( async ( req, res ) => {
	const giftFlow = req.model as GiftFlow;
	const {giftAddress, deliveryAddress} = schemaToAddresses(req.body);
	await GiftService.updateGiftFlowAddress(giftFlow, giftAddress, deliveryAddress);

	res.redirect( req.originalUrl );
} ) );

app.get( '/failed/:id', hasNewModel(GiftFlow, 'id'), ( req, res ) => {
	const giftFlow = req.model as GiftFlow;
	if (giftFlow.completed) {
		res.redirect('/gift/thanks/' + giftFlow.id);
	} else {
		res.render('failed', {id: giftFlow.id});
	}
} );

export default app;

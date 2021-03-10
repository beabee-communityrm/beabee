import express from 'express';

import { isSuperAdmin } from '@core/middleware';
import { wrapAsync } from '@core/utils';

import GCPaymentService from '@core/services/GCPaymentService';
import MembersService from '@core/services/MembersService';

const app = express();

app.set( 'views', __dirname + '/views' );

app.use(isSuperAdmin);

app.get('/', (req, res) => {
	res.render('index');
});

app.post( '/', wrapAsync( async ( req, res ) => {
	const overrides = req.body.first_name && req.body.last_name ? {
		given_name: req.body.first_name,
		family_name: req.body.last_name
	} : {};

	const partialMember = await GCPaymentService.customerToMember(req.body.customerId, overrides);
	if (partialMember) {
		const member = await MembersService.createMember(partialMember.member, partialMember.profile);
		await GCPaymentService.updatePaymentMethod(member, req.body.customerId, req.body.mandateId);
		res.redirect( '/members/' + member.id );
	} else {
		req.flash('error', 'member-add-invalid-direct-debit');
		res.redirect( app.mountpath + '/add' );
	}
} ) );

export default app;

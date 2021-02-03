import express from 'express';

import { wrapAsync } from '@core/utils';
import auth from '@core/authentication';

import PaymentService from '@core/services/PaymentService';
import MembersService from '@core/services/MembersService';

const app = express();

app.set( 'views', __dirname + '/views' );

app.use(auth.isSuperAdmin);

app.get('/', (req, res) => {
	res.render('index');
});

app.post( '/', wrapAsync( async ( req, res ) => {
	const overrides = req.body.first_name && req.body.last_name ? {
		given_name: req.body.first_name,
		family_name: req.body.last_name
	} : {};

	const memberObj = await PaymentService.customerToMember(req.body.customerId, overrides);
	if (memberObj) {
		const member = await MembersService.createMember(memberObj);
		res.redirect( app.mountpath + '/' + member.uuid );
	} else {
		req.flash('error', 'member-add-invalid-direct-debit');
		res.redirect( app.mountpath + '/add' );
	}
} ) );

export default app;

import express from 'express';

import { AppConfig, wrapAsync } from '@core/utils';
import auth from '@core/authentication';

import PaymentService from '@core/services/PaymentService';
import MembersService from '@core/services/MembersService';

const app = express();
let app_config: AppConfig;

app.set( 'views', __dirname + '/views' );

app.use(auth.isAdmin);

app.use((req, res, next) => {
	res.locals.app = app_config;
	next();
});

app.get('/', (req, res) => {
	res.render('index');
});

app.post( '/', auth.isSuperAdmin, wrapAsync( async ( req, res ) => {
	const overrides = req.body.first_name && req.body.last_name ? {
		given_name: req.body.first_name,
		family_name: req.body.last_name
	} : {};

	const memberObj = await PaymentService.customerToMember(req.body.customer_id, overrides);
	if (memberObj) {
		const member = await MembersService.createMember(memberObj);
		res.redirect( app.mountpath + '/' + member.uuid );
	} else {
		req.flash('error', 'member-add-invalid-direct-debit');
		res.redirect( app.mountpath + '/add' );
	}
} ) );

export default function (config: AppConfig): express.Express {
	app_config = config;
	return app;
}

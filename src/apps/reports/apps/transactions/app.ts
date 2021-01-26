import	express from 'express';
import moment from 'moment';

import auth from '@core/authentication';
import { wrapAsync } from '@core/utils';
import { Between, getRepository } from 'typeorm';
import Payment from '@models/Payment';
import { Members } from '@core/database';

const app = express();

app.set( 'views', __dirname + '/views' );

app.get( '/:year?/:month?', auth.isSuperAdmin, wrapAsync(async function( req, res ) {
	const start = moment.utc().startOf('month');
	if (req.params.month && req.params.year) {
		start.set({month: Number(req.params.month) - 1, year: Number(req.params.year)});
	}

	if (start.isAfter()) {
		req.flash( 'warning', 'transaction-date-in-future' );
		res.redirect('/reports/transactions');
		return;
	}

	const end = start.clone().add(1, 'month');
	const previous = start.clone().subtract(1, 'month');

	const payments = await getRepository(Payment).find({
		where: {
			createdAt: Between(start.toDate(), end.toDate())
		},
		order: {chargeDate: 'DESC'}
	});

	const successfulPayments = payments
		.filter(p => p.isSuccessful)
		.map(p => p.amount - p.amountRefunded)
		.filter(amount => !isNaN(amount));

	const total = successfulPayments.reduce((a, b) => a + b, 0);

	// TODO: Remove when members is in ORM
	const members = await Members.find({_id: {$in: payments.map(p => p.memberId)}});
	const paymentsWithMembers = payments.map(p => ({
		...p,
		member: members.find(m => m._id.equals(p.memberId))
	}));

	res.render( 'index', {
		payments: paymentsWithMembers,
		total: total,
		next: end,
		previous: previous,
		start: start
	} );
} ) );

export default app;

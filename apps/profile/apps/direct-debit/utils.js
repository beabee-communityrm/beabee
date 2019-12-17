const moment = require('moment');

const gocardless = require( __js + '/gocardless' );
const { Payments } = require( __js + '/database' );

const log = require( __js + '/logging' ).log;
const { getActualAmount, getSubscriptionName } = require( __js + '/utils' );
const { joinInfoToSubscription, startMembership } = require( __apps + '/join/utils' );

const config = require( __config );

function calcSubscriptionMonthsLeft(user) {
	return Math.max(0,
		moment.utc(user.memberPermission.date_expires)
			.subtract(config.gracePeriod).diff(moment.utc(), 'months')
	);
}

async function canChangeSubscription(user, useMandate=null) {
	if (!user.hasActiveSubscription) {
		return true;
	}

	// Only allow monthly contributors to change mandate when there isn't a payment
	// approaching to avoid double charging them
	if (useMandate !== false && user.contributionPeriod === 'monthly') {
		return true;
	}

	const payments = await Payments.find({member: user}, ['status', 'charge_date'], {
		limit: 1,
		sort: {charge_date: -1}
	});

	return payments.length === 0 || [
		'pending_customer_approval', 'pending_submission', 'submitted'
	].indexOf(payments[0].status) === -1;
}

async function getBankAccount(user) {
	if (user.gocardless.mandate_id) {
		try {
			const mandate = await gocardless.mandates.get(user.gocardless.mandate_id);
			return await gocardless.customerBankAccounts.get(mandate.links.customer_bank_account);
		} catch (err) {
			if (!err.response || err.response.status !== 404) {
				throw err;
			}
			return null;
		}
	} else {
		return null;
	}
}

async function updateSubscriptionAmount(user, newAmount) {
	const actualAmount = getActualAmount(newAmount, user.contributionPeriod);

	log.info( {
		app: 'direct-debit',
		action: 'update-subscription-amount',
		data: {
			userId: user._id,
			actualAmount
		}
	} );

	try {
		await gocardless.subscriptions.update( user.gocardless.subscription_id, {
			amount: actualAmount * 100,
			name: getSubscriptionName( actualAmount, user.contributionPeriod )
		} );
	} catch ( gcError ) {
		// Can't update subscription names if they are linked to a plan
		if ( gcError.response && gcError.response.status === 422 ) {
			await gocardless.subscriptions.update( user.gocardless.subscription_id, {
				amount: actualAmount * 100
			} );
		} else {
			throw gcError;
		}
	}
}

async function activateSubscription(user, newAmount, prorate, monthsLeft) {
	log.info( {
		app: 'direct-debit',
		action: 'activate-subscription',
		data: {
			userId: user._id,
			newAmount, prorate, monthsLeft
		}
	} );

	const prorateAmount = (newAmount - user.contributionMonthlyAmount) * monthsLeft * 100;
	if (prorateAmount === 0) {
		return true;
	} else if (prorateAmount > 0) {
		await gocardless.payments.create({
			amount: prorateAmount,
			currency: 'GBP',
			description: 'One-off payment to start new contribution',
			links: {
				mandate: user.gocardless.mandate_id
			}
		});
		return true;
	} else {
		return false;
	}
}

async function processUpdateSubscription(user, {amount, period, prorate}) {
	if (!user.canTakePayment) {
		throw new Error('User does not have active payment method');
	}

	if (user.isActiveMember) {
		const monthsLeft = calcSubscriptionMonthsLeft(user);

		if (!user.hasActiveSubscription) {
			const subscription = await gocardless.subscriptions.create({
				...joinInfoToSubscription(amount, period, user.gocardless.mandate_id),
				start_date: moment.utc(user.memberPermission.date_expires).subtract(config.gracePeriod).format('YYYY-MM-DD')
			});

			user.gocardless.subscription_id = subscription.id;
			user.gocardless.period = period;
		} else if (amount !== user.contributionMonthlyAmount) {
			await updateSubscriptionAmount(user, amount);
		}

		if (await activateSubscription(user, amount, prorate, monthsLeft)) {
			user.gocardless.amount = amount;
			user.gocardless.next_amount = undefined;
		} else {
			user.gocardless.next_amount = amount;
		}

		await user.save();
	} else {
		// TODO: handle this
		if (user.hasActiveSubscription) {
			throw new Error('Can\'t update active subscriptions for expired members');
		} else {
			await startMembership(user, {amount, period});
		}
	}
}

module.exports = {
	calcSubscriptionMonthsLeft,
	canChangeSubscription,
	getBankAccount,
	updateSubscriptionAmount,
	processUpdateSubscription
};

const moment = require('moment');

const { Payments } = require( __js + '/database' );
const { default: gocardless } = require( '@core/gocardless' );
const log = require( __js + '/logging' ).log;
const mandrill = require( __js + '/mandrill' );
const { getChargeableAmount } = require( __js + '/utils' );

const { default: MembersService } = require('@core/services/MembersService');
const { default: PaymentService } = require('@core/services/PaymentService');

const config = require( __config );

function calcSubscriptionMonthsLeft(user) {
	return Math.max(0,
		moment.utc(user.memberPermission.date_expires)
			.subtract(config.gracePeriod).diff(moment.utc(), 'months')
	);
}

async function canChangeSubscription(user, useExistingMandate) {
	if (useExistingMandate && !user.canTakePayment) {
		return false;
	}

	if (!user.hasActiveSubscription) {
		return true;
	}

	// Monthly contributors can update their contribution even if they have
	// pending payments, but they can't always change their mandate as this can
	// result in double charging
	if (useExistingMandate && user.contributionPeriod === 'monthly') {
		return true;
	} else {
		const payments = await Payments.find({member: user}, ['status', 'charge_date'], {
			limit: 1,
			sort: {charge_date: -1}
		});

		// Should always be at least 1 payment, but maybe the webhook is slow?
		return payments.length > 0 && !payments[0].isPending;
	}
}

async function getBankAccount(user) {
	if (user.gocardless.mandate_id) {
		try {
			const mandate = await gocardless.mandates.get(user.gocardless.mandate_id);
			return await gocardless.customerBankAccounts.get(mandate.links.customer_bank_account);
		} catch (err) {
			// 404s can happen on dev as we don't use real mandate IDs
			if (config.dev && err.response && err.response.status === 404) {
				return null;
			}
			throw err;
		}
	} else {
		return null;
	}
}

async function updateSubscriptionAmount(user, newAmount, payFee) {
	const chargeableAmount = getChargeableAmount(newAmount, user.contributionPeriod, payFee);

	log.info( {
		app: 'direct-debit',
		action: 'update-subscription-amount',
		data: {
			userId: user._id,
			chargeableAmount
		}
	} );

	try {
		await gocardless.subscriptions.update( user.gocardless.subscription_id, {
			amount: chargeableAmount,
			name: 'Membership' // Slowly overwrite subscription names
		} );
	} catch ( gcError ) {
		// Can't update subscription names if they are linked to a plan
		if ( gcError.response && gcError.response.status === 422 ) {
			await gocardless.subscriptions.update( user.gocardless.subscription_id, {
				amount: chargeableAmount
			} );
		} else {
			throw gcError;
		}
	}
}

async function activateSubscription(user, newAmount, prorate) {
	const monthsLeft = calcSubscriptionMonthsLeft(user);

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
	} else if (prorateAmount > 0 && prorate) {
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

async function processUpdateSubscription(user, {amount, period, prorate, payFee}) {
	if (!user.canTakePayment) {
		throw new Error('User does not have active payment method');
	}

	if (user.isActiveMember) {
		if (!user.hasActiveSubscription) {
			const startDate = moment.utc(user.memberPermission.date_expires).subtract(config.gracePeriod).format('YYYY-MM-DD');
			const subscription = await PaymentService.createSubscription(amount, period, payFee, user.gocardless.mandate_id, startDate);

			user.gocardless.subscription_id = subscription.id;
			user.gocardless.period = period;
		} else if (amount !== user.contributionMonthlyAmount || payFee !== user.gocardless.paying_fee) {
			await updateSubscriptionAmount(user, amount, payFee);
		}

		if (await activateSubscription(user, amount, prorate)) {
			user.gocardless.amount = amount;
			user.gocardless.next_amount = undefined;
		} else {
			user.gocardless.next_amount = amount;
		}
		user.gocardless.paying_fee = payFee;

		await user.save();
	} else {
		// TODO: handle this
		if (user.hasActiveSubscription) {
			throw new Error('Can\'t update active subscriptions for expired members');
		} else {
			await MembersService.startMembership(user, {amount, period, payFee});
		}
	}
}

async function handleUpdateSubscription(req, user, form) {
	const wasGift = user.contributionPeriod === 'gift';
	await processUpdateSubscription(user, form);
	if (wasGift) {
		await mandrill.sendToMember('welcome-post-gift', user);
		req.flash( 'success', 'contribution-gift-updated' );
	} else {
		req.flash( 'success', 'contribution-updated' );
	}
}

module.exports = {
	calcSubscriptionMonthsLeft,
	canChangeSubscription,
	getBankAccount,
	processUpdateSubscription,
	handleUpdateSubscription
};

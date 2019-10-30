const moment = require('moment');

const gocardless = require( __js + '/gocardless' );

const log = require( __js + '/logging' ).log;
const { getActualAmount, getSubscriptionName } = require( __js + '/utils' );
const { joinInfoToSubscription, startMembership } = require( __apps + '/join/utils' );

const config = require( __config );

// Sometimes monthly subscriptions can have slightly longer than a month left
// if the billing date changes slightly, but we should always count them as
// having less than a month left
function calcSubscriptionMonthsLeft(user) {
	return user.contributionPeriod === 'monthly' ? 0 :
		Math.max(0, moment.utc(user.memberPermission.date_expires).diff(moment.utc(), 'months'));
}

function canChangeSubscription(user) {
	return user.contributionPeriod === 'monthly' ||
		!user.hasActiveSubscription ||
		// TODO: better mechanism to recognise when a payment has already been submitted
		moment.utc(user.memberPermission.date_expires).diff(moment.utc(), 'weeks') > 2;
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
	if (monthsLeft > 0) {
		if (prorate && newAmount > user.contributionMonthlyAmount) {
			await gocardless.payments.create({
				amount: (newAmount - user.contributionMonthlyAmount) * monthsLeft * 100,
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
	} else {
		return true;
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

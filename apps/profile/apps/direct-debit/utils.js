const moment = require('moment');

// Sometimes monthly subscriptions can have slightly longer than a month left
// if the billing date changes slightly, but we should always count them as
// having less than a month left
function calcSubscriptionMonthsLeft(user) {
	return user.gocardless.period === 'monthly' ? 0 :
		moment.utc(user.memberPermission.date_expires).diff(moment.utc(), 'months');
}

function canChangeSubscription(user) {
	return user.gocardless.period === 'monthly' ||
		moment.utc(user.memberPermission.date_expires).diff(moment.utc(), 'weeks') > 2;
}

module.exports = {
	calcSubscriptionMonthsLeft,
	canChangeSubscription
};

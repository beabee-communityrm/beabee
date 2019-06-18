const moment = require('moment');

function calcSubscriptionMonthsLeft(user) {
	return moment.utc(user.memberPermission.date_expires).diff(moment.utc(), 'months');
}

module.exports = {
	calcSubscriptionMonthsLeft
};

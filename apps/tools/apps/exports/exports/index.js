const activeMembers = require('./activeMembers');
const edition = require('./edition');
const joinReasons = require('./joinReasons');
const pollLetter = require('./pollLetter');
const referrals = require('./referrals');

module.exports = {
	'active-members': activeMembers,
	'edition': edition,
	'join-reasons': joinReasons,
	'poll-letter': pollLetter,
	'referrals': referrals
};

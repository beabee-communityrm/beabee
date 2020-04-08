const { Members, Permissions } = require(__js + '/database');
const config = require( __config );

async function getParams() {
	return [{
		name: 'hasActiveSubscription',
		label: 'Has active subscription',
		type: 'boolean'
	}];
}

async function getQuery({params: {hasActiveSubscription} = {}}) {
	const permission = await Permissions.findOne( { slug: config.permission.member });
	return {
		permissions: {$elemMatch: {
			permission,
			date_expires: {$gte: new Date()}
		}},
		...(hasActiveSubscription ? {'gocardless.subscription_id': {$exists: true, $ne: ''}} : {})
	};
}

function anonymisePostcode(postcode) {
	return postcode &&
		(postcode[0] + postcode.substr(1, postcode.length - 3).replace(/[A-Za-z0-9]/g, '•') + postcode.substr(-2));
}

async function getExport(members) {
	return members
		.map(member => ({
			Id: member.uuid,
			EmailAddress: member.email,
			FirstName: member.firstname,
			LastName: member.lastname,
			ReferralLink: member.referralLink,
			PollsCode: member.pollsCode,
			ContributionMonthlyAmount: member.contributionMonthlyAmount,
			ContributionPeriod: member.contributionPeriod,
			ContributionDescription: member.contributionDescription,
			ContributionPayingFee: member.gocardless.paying_fee,
			Postcode: member.delivery_optin ? anonymisePostcode(member.delivery_address.postcode) : ''
		}))
		.sort((a, b) => a.EmailAddress < b.EmailAddress ? -1 : 1);
}

module.exports = {
	name: 'Active members export',
	statuses: ['added', 'seen'],
	collection: Members,
	itemName: 'active members',
	getParams,
	getQuery,
	getExport
};

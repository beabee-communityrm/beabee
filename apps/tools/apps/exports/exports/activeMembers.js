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
			ContributionDescription: member.contributionDescription
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

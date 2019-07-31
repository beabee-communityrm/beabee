const { Members, Permissions } = require(__js + '/database');
const config = require( __config );

async function getQuery() {
	const permission = await Permissions.findOne( { slug: config.permission.member });
	return {
		permissions: {$elemMatch: {
			permission,
			date_expires: {$gte: new Date()}
		}}
	};
}

async function getExport(members) {
	return members
		.map(member => ({
			Id: member.uuid,
			EmailAddress: member.email,
			FirstName: member.firstname,
			LastName: member.lastname,
			ReferralLink: member.referralLink
		}))
		.sort((a, b) => a.EmailAddress < b.EmailAddress ? -1 : 1);
}

module.exports = {
	name: 'Active members export',
	statuses: ['added', 'seen'],
	collection: Members,
	itemName: 'active members',
	getQuery,
	getExport
};

const _ = require('lodash');

const { Exports, Members, Permissions } = require(__js + '/database');
const { isLocalPostcode } = require( '../utils.js' );
const config = require( __config );

async function getQuery() {
	const permission = await Permissions.findOne( { slug: config.permission.member });
	return {
		'gocardless.amount': {$gte: 3}, // TODO: switch this to contributionMonthlyAmount
		permissions: {$elemMatch: {
			permission,
			date_expires: {$gte: new Date()}
		}},
		delivery_optin: true
	};
}

async function getExport(members, {_id: exportId}) {
	const exportIds =
		(await Exports.find({type: 'edition'}).sort({date: 1})).map(e => e._id);

	function getExportNo(id) {
		const i = exportIds.findIndex(id2 => id.equals(id2));
		return i > -1 ? i : exportIds.length;
	}

	const currentExportNo = getExportNo(exportId);

	return members
		.map(member => {
			const postcode = (member.delivery_address.postcode || '').trim().toUpperCase();
			return {
				FirstName: member.firstname,
				LastName: member.lastname,
				Address1: member.delivery_address.line1,
				Address2: member.delivery_address.line2,
				City: member.delivery_address.city,
				Postcode: postcode,
				ReferralLink: member.referralLink,
				IsLocal: isLocalPostcode(postcode),
				IsGift: member.contributionPeriod === 'gift',
				IsFirstEdition: _.every(member.exports, e => getExportNo(e.export_id) >= currentExportNo),
				NumCopies: member.delivery_copies === undefined ? 2 : member.delivery_copies
			};
		})
		.sort((a, b) => (
			(b.IsLocal - a.IsLocal) ||
				(b.LastName.toLowerCase() > a.LastName.toLowerCase() ? -1 : 1)
		));
}

module.exports = {
	name: 'Edition export',
	statuses: ['added', 'sent'],
	collection: Members,
	itemName: 'members',
	getQuery,
	getExport
};

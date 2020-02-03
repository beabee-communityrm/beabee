const { SpecialUrlGroups, SpecialUrls } = require(__js + '/database');

const { getSpecialUrlUrl } = require( __apps + '/tools/apps/special-urls/utils' );

async function getParams() {
	return [
		{
			name: 'groupId',
			label: 'Special URLs',
			type: 'select',
			values: (await SpecialUrlGroups.find()).map(spg => [spg._id.toString(), spg.name])
		}
	];
}

async function getQuery({params: {groupId}}) {
	return {group: groupId};
}

async function getExport(specialUrls) {
	return specialUrls.map(specialUrl => ({
		EmailAddress: specialUrl.email,
		FirstName: specialUrl.firstname,
		LastName: specialUrl.lastname,
		URL: getSpecialUrlUrl( specialUrl )
	}));
}

module.exports = {
	name: 'Special URLs export',
	statuses: ['added', 'seen'],
	collection: SpecialUrls,
	itemName: 'special URLs',
	getParams,
	getQuery,
	getExport
};

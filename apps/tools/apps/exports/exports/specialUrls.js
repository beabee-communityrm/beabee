const { SpecialUrlGroups, SpecialUrls } = require(__js + '/database');
const config = require( __config );

async function getParams() {
	return [
		{
			name: 'groupId',
			label: 'Special URLs',
			type: 'select',
			values: (await SpecialUrlGroups.find()).map(spg => [spg._id, spg.name])
		}
	];
}

async function getQuery({params: {groupId}}) {
	return {group: groupId};
}

async function getExport(specialUrls) {
	return specialUrls
		.map(specialUrl => ({
			URL: config.audience + '/s/' + specialUrl.group + '/' + specialUrl._id
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

const { Members, Permissions, PollAnswers, Polls } = require(__js + '/database');
const config = require( __config );

async function getParams() {
	return [
		{
			name: 'pollId',
			label: 'Poll',
			type: 'select',
			values: (await Polls.find()).map(poll => [poll._id, poll.question])
		}, {
			name: 'baseURL',
			label: 'Base URL',
			type: 'text'
		}
	];
}

async function getQuery({pollId}) {
	const poll = await Polls.findById(pollId);
	const pollAnswers = await PollAnswers.find({poll});
	const memberIds = pollAnswers.map(pollAnswer => pollAnswer.member);

	const permission = await Permissions.findOne( { slug: config.permission.member });

	return {
		_id: {$not: {$in: memberIds}},
		delivery_optin: true,
		'delivery_address.line1': {$exists: true},
		permissions: {$elemMatch: {
			permission,
			date_expires: {$gte: new Date()}
		}}
	};
}

async function getExport(members, {baseURL}) {
	return members.map(member => {
		const addressFields = Object.assign(
			...['line1', 'line2', 'city', 'postcode']
				.map(field => member.delivery_address[field])
				.filter(line => !!line)
				.map((field, i) => ({['Address' + (i + 1)]: field}))
		);

		return {
			'First name': member.firstname,
			Surname: member.lastname,
			'Full name': member.fullname,
			'Custom 1': baseURL + '/' + member.pollsCode,
			'Custom 2': member.uuid,
			...addressFields
		};
	});
}

module.exports = {
	name: 'Poll letter export',
	statuses: ['added', 'seen'],
	collection: Members,
	itemName: 'members',
	getParams,
	getQuery,
	getExport
};

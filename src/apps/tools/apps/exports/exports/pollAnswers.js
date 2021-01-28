const flat = require('flat');

async function getParams() {
	return [
		{
			name: 'pollId',
			label: 'Poll',
			type: 'select',
			values: (await Polls.find()).map(poll => [poll._id.toString(), poll.title])
		}
	];
}

async function getQuery({params}) {
	return {poll: params.pollId};
}

async function getExport(pollAnswers) {
	await PollAnswers.populate(pollAnswers, {path: 'member'});

	return pollAnswers.map(pollAnswer => {
		const member = pollAnswer.member || {};

		return {
			'First name': member.firstname,
			Surname: member.lastname,
			'Full name': member.fullname,
			'Email address': member.email,
			'Date': pollAnswer.createdAt,
			...flat(pollAnswer.answers)
		};
	});
}

module.exports = {
	name: 'Poll answers export',
	statuses: ['added', 'seen'],
	collection: null,
	itemName: 'poll answers',
	getParams,
	getQuery,
	getExport
};

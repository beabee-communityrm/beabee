const { PollAnswers } = require( __js + '/database' );
const mailchimp = require( __js + '/mailchimp' );

function getPollTemplate(poll) {
	switch (poll.formTemplate) {
	case 'ballot': return 'ballot';
	case 'builder': return 'poll';
	case 'custom': return `polls/${poll.slug}`;
	}
}

class PollAnswerError extends Error {
	constructor(message) {
		super(message);
		this.name = 'PollAnswerError';
	}
}

async function setAnswers( poll, member, answers, isPartial=false ) {
	if (!member.isActiveMember) {
		throw new PollAnswerError('polls-expired-user');
	} else if (!poll.active) {
		throw new PollAnswerError('polls-closed');
	}

	if (!poll.allowUpdate) {
		const pollAnswer = await PollAnswers.findOne({ member, poll });
		if (pollAnswer && !pollAnswer.isPartial) {
			throw new PollAnswerError('polls-cant-update');
		}
	}

	await PollAnswers.findOneAndUpdate( { poll, member }, {
		$set: { poll, member, answers, isPartial }
	}, { upsert: true } );

	if (poll.mergeField) {
		await mailchimp.mainList.updateMemberFields( member, {
			[poll.mergeField]: answers
		} );
	}
}

module.exports = {
	getPollTemplate,
	PollAnswerError,
	setAnswers
};

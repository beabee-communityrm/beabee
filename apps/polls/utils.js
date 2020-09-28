const { PollAnswers } = require( __js + '/database' );
const mailchimp = require( __js + '/mailchimp' );

function getPollTemplate(poll) {
	switch (poll.formTemplate) {
	case 'builder': return 'poll';
	case 'custom': return `polls/${poll.slug}`;
	}
}

// TODO: remove _csrf in a less hacky way
async function setAnswer( poll, member, { answer, _csrf, isAsync, ...otherAdditionalAnswers } ) { // eslint-disable-line no-unused-vars
	if (!member.isActiveMember) {
		return 'polls-expired-user';
	} else if (poll.active) {
		if (!poll.allowUpdate) {
			const pollAnswer = await PollAnswers.findOne({ member, poll });
			if (pollAnswer) {
				return 'polls-cant-update';
			}
		}

		if (poll.formTemplate === 'builder') {
			otherAdditionalAnswers = JSON.parse(answer);
			answer = 'Yes';
		}

		const additionalAnswers = isAsync ?  { 'additionalAnswers.isAsync': true } :
			{ 'additionalAnswers': otherAdditionalAnswers };

		await PollAnswers.findOneAndUpdate( { poll, member }, {
			$set: { poll, member, answer, ...additionalAnswers }
		}, { upsert: true } );

		if (poll.mergeField) {
			await mailchimp.mainList.updateMemberFields( member, {
				[poll.mergeField]: answer
			} );
		}
	} else {
		return 'polls-closed';
	}
}

module.exports = {
	getPollTemplate,
	setAnswer
};

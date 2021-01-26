import { getRepository, LessThan } from 'typeorm';

import mailchimp from '@core/mailchimp';

import { Member } from '@models/members';
import Poll from '@models/Poll';
import PollResponse from '@models/PollResponse';

class PollWithResponse extends Poll {
	response?: PollResponse;
}

export default class PollsService {
	static async getPollsWithResponses(member: Member): Promise<PollWithResponse[]> {

		const polls = await getRepository(Poll).find({
			where: [
				{starts: null},
				{starts: LessThan(new Date())}
			],
			order: {
				date: 'DESC'
			}
		});

		const responses = await getRepository(PollResponse).find( { memberId: member.id } );

		const pollsWithResponses = polls.map(poll => {
			const pwr = new PollWithResponse();
			Object.assign(pwr, poll);
			pwr.response = responses.find(r => r.poll.slug === poll.slug);
			return pwr;
		});

		return pollsWithResponses;
	}

	static async getResponse(poll: Poll, member: Member): Promise<PollResponse|undefined> {
		return await getRepository(PollResponse).findOne({
			poll: {slug: poll.slug}, memberId: member.id
		});
	}

	static async setResponse( poll: Poll, member: Member, answers: Record<string, unknown>, isPartial=false ): Promise<string|void> {
		if (!member.isActiveMember) {
			return 'polls-expired-user';
		} else if (!poll.active) {
			return 'polls-closed';
		}

		if (!poll.allowUpdate) {
			const pollAnswer = await PollsService.getResponse(poll, member);
			if (pollAnswer && !pollAnswer.isPartial) {
				return 'polls-cant-update';
			}
		}

		const pollResponse = new PollResponse();
		pollResponse.poll = poll;
		pollResponse.memberId = member.id;
		pollResponse.answers = answers;
		pollResponse.isPartial = isPartial;

		await getRepository(PollResponse).save(pollResponse);

		if (poll.mcMergeField && poll.pollMergeField) {
			await mailchimp.mainList.updateMemberFields( member, {
				[poll.mcMergeField]: answers[poll.pollMergeField]
			} );
		}
	}

}

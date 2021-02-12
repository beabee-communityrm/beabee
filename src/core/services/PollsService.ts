import { getRepository, IsNull, LessThan } from 'typeorm';

import mailchimp from '@core/mailchimp';

import { Member } from '@models/members';
import Poll from '@models/Poll';
import PollResponse, { PollResponseAnswers } from '@models/PollResponse';

class PollWithResponse extends Poll {
	response?: PollResponse;
}

export default class PollsService {
	static async getVisiblePollsWithResponses(member: Member): Promise<PollWithResponse[]> {

		const polls = await getRepository(Poll).find({
			where: [
				{starts: IsNull(), hidden: false},
				{starts: LessThan(new Date()), hidden: false}
			],
			order: {
				date: 'DESC'
			}
		});

		const responses = await getRepository(PollResponse).find( {
			loadRelationIds: true,
			where: {
				memberId: member.id
			}
		});

		console.log(responses);

		const pollsWithResponses = polls.map(poll => {
			const pwr = new PollWithResponse();
			Object.assign(pwr, poll);
			pwr.response = responses.find(r => (r.poll as unknown as string) === poll.slug);
			return pwr;
		});

		return pollsWithResponses;
	}

	static async getResponse(poll: Poll, member: Member): Promise<PollResponse|undefined> {
		return await getRepository(PollResponse).findOne({
			poll: {slug: poll.slug}, memberId: member.id
		});
	}

	static async setResponse( poll: Poll, member: Member, answers: PollResponseAnswers, isPartial=false ): Promise<string|undefined> {
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

	static async setGuestResponse( poll: Poll, guestName: string, guestEmail: string, answers: PollResponseAnswers): Promise<string|undefined> {
		if (!poll.active || !poll.public) {
			return 'poll-closed';
		}

		const pollResponse = new PollResponse();
		pollResponse.poll = poll;
		pollResponse.guestName = guestName;
		pollResponse.guestEmail = guestEmail;
		pollResponse.answers = answers;
		pollResponse.isPartial = false;

		await getRepository(PollResponse).save(pollResponse);
	}
}

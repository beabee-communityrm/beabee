import { getRepository, IsNull, LessThan } from "typeorm";

import NewsletterService from "@core/services/NewsletterService";

import Member from "@models/Member";
import Poll, { PollAccess } from "@models/Poll";
import PollResponse, { PollResponseAnswers } from "@models/PollResponse";

class PollWithResponse extends Poll {
  response?: PollResponse;
}

export default class PollsService {
  static async getVisiblePollsWithResponses(
    member: Member
  ): Promise<PollWithResponse[]> {
    const polls = await getRepository(Poll).find({
      where: [
        { starts: IsNull(), hidden: false },
        { starts: LessThan(new Date()), hidden: false }
      ],
      order: {
        date: "DESC"
      }
    });

    const responses = await getRepository(PollResponse).find({
      loadRelationIds: true,
      where: { member }
    });

    const pollsWithResponses = polls.map((poll) => {
      const pwr = new PollWithResponse();
      Object.assign(pwr, poll);
      pwr.response = responses.find(
        (r) => (r.poll as unknown as string) === poll.slug
      );
      return pwr;
    });

    return pollsWithResponses;
  }

  static async getResponse(
    poll: Poll,
    member: Member
  ): Promise<PollResponse | undefined> {
    return await getRepository(PollResponse).findOne({
      poll: { slug: poll.slug },
      member
    });
  }

  static async setResponse(
    poll: Poll,
    member: Member,
    answers: PollResponseAnswers,
    isPartial = false
  ): Promise<string | undefined> {
    if (!member.isActiveMember) {
      return "polls-expired-user";
    } else if (!poll.active) {
      return "polls-closed";
    }

    let pollResponse = await PollsService.getResponse(poll, member);
    if (pollResponse) {
      if (!poll.allowUpdate && !pollResponse.isPartial) {
        return "polls-cant-update";
      }
    } else {
      pollResponse = new PollResponse();
      pollResponse.poll = poll;
      pollResponse.member = member;
    }

    pollResponse.answers = answers;
    pollResponse.isPartial = isPartial;

    await getRepository(PollResponse).save(pollResponse);

    if (poll.mcMergeField && poll.pollMergeField) {
      await NewsletterService.updateMemberFields(member, {
        [poll.mcMergeField]: answers[poll.pollMergeField].toString()
      });
    }
  }

  static async setGuestResponse(
    poll: Poll,
    guestName: string | undefined,
    guestEmail: string | undefined,
    answers: PollResponseAnswers
  ): Promise<string | undefined> {
    if (!poll.active || poll.access === PollAccess.Member) {
      return "poll-closed";
    }

    const pollResponse = new PollResponse();
    pollResponse.poll = poll;
    pollResponse.guestName = guestName;
    pollResponse.guestEmail = guestEmail;
    pollResponse.answers = answers;
    pollResponse.isPartial = false;

    await getRepository(PollResponse).save(pollResponse);
  }

  static async getPoll(pollSlug: string): Promise<Poll | undefined> {
    return await getRepository(Poll).findOne(pollSlug);
  }
}

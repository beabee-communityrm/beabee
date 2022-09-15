import { getRepository, IsNull, LessThan } from "typeorm";

import EmailService from "@core/services/EmailService";
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
      where: { starts: LessThan(new Date()), hidden: false },
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
      )!;
      return pwr;
    });

    return pollsWithResponses;
  }

  static async getResponse(
    poll: Poll,
    member: Member
  ): Promise<PollResponse | undefined> {
    return await getRepository(PollResponse).findOne({
      where: {
        poll: { slug: poll.slug },
        member
      },
      // Get most recent response for polls with allowMultiple
      order: { createdAt: "DESC" }
    });
  }

  static async setResponse(
    poll: Poll,
    member: Member,
    answers: PollResponseAnswers,
    isPartial = false
  ): Promise<
    "only-anonymous" | "expired-user" | "closed" | "cant-update" | undefined
  > {
    if (poll.access === PollAccess.OnlyAnonymous) {
      return "only-anonymous";
    } else if (
      !member.membership?.isActive &&
      poll.access === PollAccess.Member
    ) {
      return "expired-user";
    } else if (!poll.active) {
      return "closed";
    }

    // Don't allow partial answers for multiple answer polls
    if (poll.allowMultiple && isPartial) {
      return;
    }

    let pollResponse = await PollsService.getResponse(poll, member);
    if (pollResponse && !poll.allowMultiple) {
      if (!poll.allowUpdate && !pollResponse.isPartial) {
        return "cant-update";
      }
    } else {
      pollResponse = new PollResponse();
      pollResponse.poll = poll;
      pollResponse.member = member;
    }

    pollResponse.answers = answers;
    pollResponse.isPartial = isPartial;

    await getRepository(PollResponse).save(pollResponse);

    await EmailService.sendTemplateToAdmin("new-callout-response", {
      poll,
      responderName: member.fullname
    });

    if (poll.mcMergeField && poll.pollMergeField) {
      await NewsletterService.updateMemberFields(member, {
        [poll.mcMergeField]: answers[poll.pollMergeField]?.toString() || ""
      });
    }
  }

  static async setGuestResponse(
    poll: Poll,
    guestName: string | undefined,
    guestEmail: string | undefined,
    answers: PollResponseAnswers
  ): Promise<"guest-fields-missing" | "only-anonymous" | "closed" | undefined> {
    if (poll.access === PollAccess.Guest && !(guestName && guestEmail)) {
      return "guest-fields-missing";
    } else if (
      poll.access === PollAccess.OnlyAnonymous &&
      (guestName || guestEmail)
    ) {
      return "only-anonymous";
    } else if (!poll.active || poll.access === PollAccess.Member) {
      return "closed";
    }

    const pollResponse = new PollResponse();
    pollResponse.poll = poll;
    pollResponse.guestName = guestName || null;
    pollResponse.guestEmail = guestEmail || null;
    pollResponse.answers = answers;
    pollResponse.isPartial = false;

    await getRepository(PollResponse).save(pollResponse);

    await EmailService.sendTemplateToAdmin("new-callout-response", {
      poll,
      responderName: guestName || "Anonymous"
    });
  }

  static async getPoll(pollSlug: string): Promise<Poll | undefined> {
    return await getRepository(Poll).findOne(pollSlug);
  }
}

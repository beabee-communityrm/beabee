import { getRepository, IsNull, LessThan } from "typeorm";

import EmailService from "@core/services/EmailService";
import NewsletterService from "@core/services/NewsletterService";

import Contact from "@models/Contact";
import Callout, { CalloutAccess } from "@models/Callout";
import CalloutResponse, {
  CalloutResponseAnswers
} from "@models/CalloutResponse";

class CalloutWithResponse extends Callout {
  response?: CalloutResponse;
}

export default class CalloutsService {
  static async getVisibleCalloutsWithResponses(
    contact: Contact
  ): Promise<CalloutWithResponse[]> {
    const callouts = await getRepository(Callout).find({
      where: [
        { starts: IsNull(), hidden: false },
        { starts: LessThan(new Date()), hidden: false }
      ],
      order: {
        date: "DESC"
      }
    });

    const responses = await getRepository(CalloutResponse).find({
      loadRelationIds: true,
      where: { contact: contact }
    });

    const calloutsWithResponses = callouts.map((callout) => {
      const pwr = new CalloutWithResponse();
      Object.assign(pwr, callout);
      pwr.response = responses.find(
        (r) => (r.callout as unknown as string) === callout.slug
      )!;
      return pwr;
    });

    return calloutsWithResponses;
  }

  static async getResponse(
    callout: Callout,
    contact: Contact
  ): Promise<CalloutResponse | undefined> {
    return await getRepository(CalloutResponse).findOne({
      where: {
        callout: { slug: callout.slug },
        contact: contact
      },
      // Get most recent response for callouts with allowMultiple
      order: { createdAt: "DESC" }
    });
  }

  static async setResponse(
    callout: Callout,
    contact: Contact,
    answers: CalloutResponseAnswers,
    isPartial = false
  ): Promise<
    "only-anonymous" | "expired-user" | "closed" | "cant-update" | undefined
  > {
    if (callout.access === CalloutAccess.OnlyAnonymous) {
      return "only-anonymous";
    } else if (
      !contact.membership?.isActive &&
      callout.access === CalloutAccess.Member
    ) {
      return "expired-user";
    } else if (!callout.active) {
      return "closed";
    }

    // Don't allow partial answers for multiple answer callouts
    if (callout.allowMultiple && isPartial) {
      return;
    }

    let response = await CalloutsService.getResponse(callout, contact);
    if (response && !callout.allowMultiple) {
      if (!callout.allowUpdate && !response.isPartial) {
        return "cant-update";
      }
    } else {
      response = new CalloutResponse();
      response.callout = callout;
      response.contact = contact;
    }

    response.answers = answers;
    response.isPartial = isPartial;

    await getRepository(CalloutResponse).save(response);

    await EmailService.sendTemplateToAdmin("new-callout-response", {
      callout: callout,
      responderName: contact.fullname
    });

    if (callout.mcMergeField && callout.pollMergeField) {
      await NewsletterService.updateContactFields(contact, {
        [callout.mcMergeField]:
          answers[callout.pollMergeField]?.toString() || ""
      });
    }
  }

  static async setGuestResponse(
    callout: Callout,
    guestName: string | undefined,
    guestEmail: string | undefined,
    answers: CalloutResponseAnswers
  ): Promise<"guest-fields-missing" | "only-anonymous" | "closed" | undefined> {
    if (callout.access === CalloutAccess.Guest && !(guestName && guestEmail)) {
      return "guest-fields-missing";
    } else if (
      callout.access === CalloutAccess.OnlyAnonymous &&
      (guestName || guestEmail)
    ) {
      return "only-anonymous";
    } else if (!callout.active || callout.access === CalloutAccess.Member) {
      return "closed";
    }

    const response = new CalloutResponse();
    response.callout = callout;
    response.guestName = guestName || null;
    response.guestEmail = guestEmail || null;
    response.answers = answers;
    response.isPartial = false;

    await getRepository(CalloutResponse).save(response);

    await EmailService.sendTemplateToAdmin("new-callout-response", {
      callout: callout,
      responderName: guestName || "Anonymous"
    });
  }
}

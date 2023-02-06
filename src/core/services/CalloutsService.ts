import { getRepository, IsNull, LessThan } from "typeorm";
import { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";

import EmailService from "@core/services/EmailService";
import NewsletterService from "@core/services/NewsletterService";

import { isDuplicateIndex } from "@core/utils";

import Contact from "@models/Contact";
import Callout, { CalloutAccess } from "@models/Callout";
import CalloutResponse, {
  CalloutResponseAnswers
} from "@models/CalloutResponse";

import DuplicateId from "@api/errors/DuplicateId";
import { CreateCalloutData } from "@api/data/CalloutData";
import { CalloutFormSchema } from "@beabee/beabee-common";

class CalloutWithResponse extends Callout {
  response?: CalloutResponse;
}

class CalloutsService {
  async getVisibleCalloutsWithResponses(
    contact: Contact
  ): Promise<CalloutWithResponse[]> {
    const callouts = await getRepository(Callout).find({
      where: { starts: LessThan(new Date()), hidden: false },
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

  async createCallout(
    data: CreateCalloutData & { slug: string },
    autoSlug: number | false
  ): Promise<Callout> {
    const slug = data.slug + (autoSlug > 0 ? "-" + autoSlug : "");
    try {
      await getRepository(Callout).insert({
        ...data,
        slug,
        // Force the correct type as otherwise this errors, not sure why
        formSchema: data.formSchema as QueryDeepPartialEntity<CalloutFormSchema>
      });
      return await getRepository(Callout).findOneOrFail(slug);
    } catch (err) {
      if (isDuplicateIndex(err, "slug")) {
        if (autoSlug === false) {
          throw new DuplicateId(slug);
        } else {
          return await this.createCallout(data, autoSlug + 1);
        }
      } else {
        throw err;
      }
    }
  }

  async getResponse(
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

  async setResponse(
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

    let response = await this.getResponse(callout, contact);
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

  async setGuestResponse(
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

export default new CalloutsService();

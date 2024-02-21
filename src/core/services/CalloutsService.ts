import {
  CalloutFormSchema,
  CalloutResponseAnswers
} from "@beabee/beabee-common";
import { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";

import EmailService from "@core/services/EmailService";
import NewsletterService from "@core/services/NewsletterService";

import { getRepository } from "@core/database";
import { isDuplicateIndex } from "@core/utils";

import Contact from "@models/Contact";
import Callout from "@models/Callout";
import CalloutResponse from "@models/CalloutResponse";

import DuplicateId from "@api/errors/DuplicateId";

import InvalidCalloutResponse from "@api/errors/InvalidCalloutResponse";

import { CalloutAccess } from "@enums/callout-access";
import { CalloutData } from "@type/callout-data";

class CalloutsService {
  async createCallout(
    data: CalloutData & { slug: string },
    autoSlug: number | false
  ): Promise<Callout> {
    const slug = data.slug + (autoSlug && autoSlug > 0 ? "-" + autoSlug : "");
    try {
      await getRepository(Callout).insert({
        ...data,
        slug,
        // Force the correct type as otherwise this errors, not sure why
        formSchema: data.formSchema as QueryDeepPartialEntity<CalloutFormSchema>
      });
      return await getRepository(Callout).findOneByOrFail({ slug });
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
    return (
      (await getRepository(CalloutResponse).findOne({
        where: {
          calloutId: callout.id,
          contactId: contact.id
        },
        // Get most recent response for callouts with allowMultiple
        order: { createdAt: "DESC" }
      })) || undefined
    );
  }

  async setResponse(
    callout: Callout,
    contact: Contact,
    answers: CalloutResponseAnswers,
    isPartial = false
  ): Promise<CalloutResponse> {
    if (callout.access === CalloutAccess.OnlyAnonymous) {
      throw new InvalidCalloutResponse("only-anonymous");
    } else if (
      !contact.membership?.isActive &&
      callout.access === CalloutAccess.Member
    ) {
      throw new InvalidCalloutResponse("expired-user");
    } else if (!callout.active) {
      throw new InvalidCalloutResponse("closed");
    }

    // Don't allow partial answers for multiple answer callouts
    if (callout.allowMultiple && isPartial) {
      throw new Error(
        "Partial answers for multiple answer callouts not supported"
      );
    }

    let response = await this.getResponse(callout, contact);
    if (response && !callout.allowMultiple) {
      if (!callout.allowUpdate && !response.isPartial) {
        throw new InvalidCalloutResponse("cant-update");
      }
    } else {
      response = new CalloutResponse();
      response.callout = callout;
      response.contact = contact || null;
    }

    response.answers = answers;
    response.isPartial = isPartial;

    const savedResponse = await this.saveResponse(response);

    await EmailService.sendTemplateToAdmin("new-callout-response", {
      callout: callout,
      responderName: contact.fullname
    });

    if (callout.mcMergeField && callout.pollMergeField) {
      const [slideId, answerKey] = callout.pollMergeField.split(".");
      await NewsletterService.updateContactFields(contact, {
        [callout.mcMergeField]: answers[slideId]?.[answerKey]?.toString() || ""
      });
    }

    return savedResponse;
  }

  async setGuestResponse(
    callout: Callout,
    guestName: string | undefined,
    guestEmail: string | undefined,
    answers: CalloutResponseAnswers
  ): Promise<CalloutResponse> {
    if (callout.access === CalloutAccess.Guest && !(guestName && guestEmail)) {
      throw new InvalidCalloutResponse("guest-fields-missing");
    } else if (
      callout.access === CalloutAccess.OnlyAnonymous &&
      (guestName || guestEmail)
    ) {
      throw new InvalidCalloutResponse("only-anonymous");
    } else if (!callout.active || callout.access === CalloutAccess.Member) {
      throw new InvalidCalloutResponse("closed");
    }

    const response = new CalloutResponse();
    response.callout = callout;
    response.guestName = guestName || null;
    response.guestEmail = guestEmail || null;
    response.answers = answers;
    response.isPartial = false;

    const savedResponse = await this.saveResponse(response);

    await EmailService.sendTemplateToAdmin("new-callout-response", {
      callout: callout,
      responderName: guestName || "Anonymous"
    });

    return savedResponse;
  }

  private async saveResponse(
    response: CalloutResponse
  ): Promise<CalloutResponse> {
    if (!response.number) {
      const lastResponse = await getRepository(CalloutResponse).findOne({
        where: { calloutId: response.callout.id },
        order: { number: "DESC" }
      });

      response.number = lastResponse ? lastResponse.number + 1 : 1;
    }

    try {
      return await getRepository(CalloutResponse).save(response);
    } catch (error) {
      if (isDuplicateIndex(error)) {
        response.number = 0;
        return await this.saveResponse(response);
      } else {
        throw error;
      }
    }
  }
}

export default new CalloutsService();

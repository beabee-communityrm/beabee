import {
  CalloutFormSchema,
  CalloutResponseAnswers
} from "@beabee/beabee-common";
import { BadRequestError } from "routing-controllers";
import { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";

import EmailService from "@core/services/EmailService";
import NewsletterService from "@core/services/NewsletterService";
import OptionsService from "@core/services/OptionsService";

import { getRepository, runTransaction } from "@core/database";
import { isDuplicateIndex } from "@core/utils";

import Contact from "@models/Contact";
import Callout from "@models/Callout";
import CalloutResponse from "@models/CalloutResponse";
import CalloutResponseComment from "@models/CalloutResponseComment";
import CalloutResponseTag from "@models/CalloutResponseTag";
import CalloutTag from "@models/CalloutTag";
import CalloutVariant from "@models/CalloutVariant";

import DuplicateId from "@api/errors/DuplicateId";

import InvalidCalloutResponse from "@api/errors/InvalidCalloutResponse";

import { CalloutAccess } from "@enums/callout-access";
import { CalloutData } from "@type/callout-data";

class CalloutsService {
  /**
   * Create a new callout
   * @param data The callout data
   * @param autoSlug Whether or not to automatically add a number to the slug if it's a duplicate
   * @returns The new callout
   */
  async createCallout(
    data: CalloutData & { slug: string },
    autoSlug: number | false
  ): Promise<Callout> {
    const slug = data.slug + (autoSlug && autoSlug > 0 ? "-" + autoSlug : "");
    try {
      await getRepository(Callout).insert(this.fixData({ ...data, slug }));
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

  /**
   * Update a callout with the given slug, this also handles updating the slug itself
   * @param slug The callout slug
   * @param data The new callout data, this can contain a new slug
   * @returns The updated callout
   */
  async updateCallout(
    slug: string,
    data: Partial<CalloutData>
  ): Promise<Callout | undefined> {
    const newSlug = data.slug || slug;

    // Prevent the join survey from being made inactive
    if (OptionsService.getText("join-survey") === slug) {
      if (data.expires) {
        throw new BadRequestError(
          "Cannot set an expiry date on the join survey"
        );
      } else if (data.starts === null) {
        throw new BadRequestError("Cannot set join survey to draft");
      } else if (data.starts && data.starts > new Date()) {
        throw new BadRequestError("Cannot set join survey to scheduled");
      }
    }

    try {
      await getRepository(Callout).update(slug, this.fixData(data));
      return (
        (await getRepository(Callout).findOneBy({ slug: newSlug })) || undefined
      );
    } catch (err) {
      throw isDuplicateIndex(err, "slug") ? new DuplicateId(newSlug) : err;
    }
  }

  /**
   * Delete the callout with the given slug and all it's related data
   * @param slug The callout slug
   * @returns true if the callout was deleted
   */
  async deleteCallout(slug: string): Promise<boolean> {
    return await runTransaction(async (em) => {
      await em
        .createQueryBuilder()
        .delete()
        .from(CalloutResponseComment)
        .where((qb) => {
          const subQuery = em
            .createQueryBuilder()
            .subQuery()
            .select("id")
            .from(CalloutResponse, "cr")
            .where("cr.calloutSlug = :slug", { slug });
          qb.where("responseId IN " + subQuery.getQuery());
        })
        .execute();

      await em
        .createQueryBuilder()
        .delete()
        .from(CalloutResponseTag)
        .where((qb) => {
          const subQuery = em
            .createQueryBuilder()
            .subQuery()
            .select("id")
            .from(CalloutResponse, "cr")
            .where("cr.calloutSlug = :slug", { slug });
          qb.where("responseId IN " + subQuery.getQuery());
        })
        .execute();

      await em.getRepository(CalloutResponse).delete({ calloutSlug: slug });
      await em.getRepository(CalloutVariant).delete({ calloutSlug: slug });
      await em.getRepository(CalloutTag).delete({ calloutSlug: slug });

      const result = await getRepository(Callout).delete(slug);

      return result.affected === 1;
    });
  }

  /**
   * Get the most recent response for the given callout and contact
   * @param callout The callout
   * @param contact The contact
   * @returns The most recent response
   */
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

  /**
   * Creates a response for the given callout and contact, ensuring the contact has
   * the correct access and the callout is active
   * @param callout The callout
   * @param contact The contact
   * @param answers The response answers
   * @param isPartial Deprecated: whether or not the answers are partial or not
   * @returns The new callout response
   */
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

    await this.notifyAdmin(callout, contact.fullname);

    if (callout.mcMergeField && callout.pollMergeField) {
      const [slideId, answerKey] = callout.pollMergeField.split(".");
      await NewsletterService.updateContactFields(contact, {
        [callout.mcMergeField]: answers[slideId]?.[answerKey]?.toString() || ""
      });
    }

    return savedResponse;
  }

  /**
   * Creates a guest response for the given callout
   * @param callout The callout
   * @param guestName The guest's name or undefined for an anonymous response
   * @param guestEmail The guest's email or undefined for an anonymous response
   * @param answers The response answers
   * @returns The new callout response
   */
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

    await this.notifyAdmin(callout, guestName || "Anonymous");

    return savedResponse;
  }

  /**
   * This is a hack used to force the correct type for formSchema, for some reason
   * CalloutFormSchema isn't compatible with QueryDeepPartialEntity<CalloutFormSchema>
   * @param data
   * @returns The data
   */
  private fixData(data: Partial<CalloutData>): QueryDeepPartialEntity<Callout> {
    const { formSchema, ...restData } = data;
    return {
      ...restData,
      ...(formSchema && {
        formSchema: formSchema as QueryDeepPartialEntity<CalloutFormSchema>
      })
    };
  }

  /**
   * Handles saving the response, ensuring the number is unique and probably sequential
   * @param response The response to save
   * @returns The updated response
   */
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

  /**
   * Notify admins about a new response. Handles fetching the callout title
   * in the default variant if it's not already available
   * @param callout The callout
   * @param responderName The name of the responder
   */
  private async notifyAdmin(
    callout: Callout,
    responderName: string
  ): Promise<void> {
    const variant =
      callout.variants.find((v) => v.locale === "default") ||
      (await getRepository(CalloutVariant).findOneBy({
        calloutSlug: callout.slug,
        locale: "default"
      }));

    await EmailService.sendTemplateToAdmin("new-callout-response", {
      calloutSlug: callout.slug,
      calloutTitle: variant?.title || "Unknown title",
      responderName: responderName
    });
  }
}

export default new CalloutsService();

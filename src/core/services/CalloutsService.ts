import {
  GetCalloutFormSchema,
  CalloutResponseAnswersSlide,
  CalloutAccess,
  CreateCalloutData
} from "@beabee/beabee-common";
import slugify from "slugify";
import { BadRequestError } from "routing-controllers";
import { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";

import EmailService from "@core/services/EmailService";
import NewsletterService from "@core/services/NewsletterService";
import OptionsService from "@core/services/OptionsService";

import { getRepository, runTransaction } from "@core/database";
import { log as mainLogger } from "@core/logging";
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
import NotFoundError from "@api/errors/NotFoundError";

const log = mainLogger.child({ app: "callouts-service" });

class CalloutsService {
  /**
   * Create a new callout
   * @param data The callout data
   * @param autoSlug Whether or not to automatically add a number to the slug if it's a duplicate
   * @returns The new callout ID
   */
  async createCallout(
    data: CreateCalloutData,
    autoSlug: number | false
  ): Promise<string> {
    if (!data.variants?.default) {
      throw new BadRequestError(
        "Default variant is required to create callout"
      );
    }

    const baseSlug =
      data.slug || slugify(data.variants.default.title, { lower: true });

    while (true) {
      const slug = baseSlug + (autoSlug ? "-" + autoSlug : "");
      log.info("Creating callout with slug " + slug);
      try {
        return await this.saveCallout({ ...data, slug });
      } catch (err) {
        if (err instanceof DuplicateId && autoSlug !== false) {
          autoSlug++;
        } else {
          throw err;
        }
      }
    }
  }

  /**
   * Update a callout
   * @param id The callout ID
   * @param data The new callout data
   * @returns The updated callout
   */
  async updateCallout(
    id: string,
    data: Partial<CreateCalloutData>
  ): Promise<void> {
    log.info("Updating callout " + id);
    // Prevent the join survey from being made inactive
    if (OptionsService.getText("join-survey") === id) {
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

    await this.saveCallout(data, id);
  }

  async duplicateCallout(id: string): Promise<string> {
    const callout = await getRepository(Callout).findOne({
      where: { id },
      relations: { variants: true, tags: true }
    });
    if (!callout) {
      throw new NotFoundError();
    }

    const { id: removeId, tags, variants, ...calloutData } = callout;

    const data: CreateCalloutData = {
      ...calloutData,
      variants: Object.fromEntries(
        variants.map((variant) => [variant.name, variant])
      )
    };

    const newId = await this.createCallout(data, 0);

    if (tags.length > 0) {
      await getRepository(CalloutTag).save(
        tags.map((tag) => {
          const { id, ...newTag } = tag;
          return { ...newTag, calloutId: newId };
        })
      );
    }

    return newId;
  }

  /**
   * Delete a callout and all it's related data
   * @param id The callout ID
   * @returns true if the callout was deleted
   */
  async deleteCallout(id: string): Promise<boolean> {
    log.info("Deleting callout " + id);

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
            .where("cr.calloutId = :id");
          qb.where("responseId IN " + subQuery.getQuery());
        })
        .setParameters({ id })
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
            .where("cr.calloutId = :id");
          qb.where("responseId IN " + subQuery.getQuery());
        })
        .setParameters({ id })
        .execute();

      await em.getRepository(CalloutResponse).delete({ calloutId: id });
      await em.getRepository(CalloutVariant).delete({ calloutId: id });
      await em.getRepository(CalloutTag).delete({ calloutId: id });

      const result = await em.getRepository(Callout).delete({ id });

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
    answers: CalloutResponseAnswersSlide,
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
    answers: CalloutResponseAnswersSlide
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
   * Saves a callout and it's variants, handling duplicate slug errors
   * @param data
   * @returns The data
   */
  private async saveCallout(
    data: Partial<CreateCalloutData>,
    id?: string
  ): Promise<string> {
    const { formSchema, variants, ...calloutData } = data;

    // For some reason GetCalloutFormSchema isn't compatible with
    // QueryDeepPartialEntity<GetCalloutFormSchema> so we force it
    const fixedData = {
      ...calloutData,
      ...(formSchema && {
        formSchema: formSchema as QueryDeepPartialEntity<GetCalloutFormSchema>
      })
    };

    return await runTransaction(async (em) => {
      try {
        if (id) {
          const result = await em.getRepository(Callout).update(id, fixedData);
          if (result.affected === 0) {
            throw new NotFoundError();
          }
        } else {
          const result = await em.getRepository(Callout).insert(fixedData);
          id = result.identifiers[0].id as string;
        }
      } catch (err) {
        throw isDuplicateIndex(err, "slug")
          ? new DuplicateId(data.slug || "") // Slug can't actually be undefined here
          : err;
      }

      // Type checker doesn't understand that id is defined here
      const newId = id;

      if (variants) {
        await em.getRepository(CalloutVariant).save(
          Object.entries(variants).map(([name, variant]) => ({
            ...variant,
            name,
            calloutId: newId
          }))
        );
      }

      log.info("Saved callout " + newId);

      return newId;
    });
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
      callout.variants?.find((v) => v.name === "default") ||
      (await getRepository(CalloutVariant).findOneBy({
        calloutId: callout.id,
        name: "default"
      }));

    await EmailService.sendTemplateToAdmin("new-callout-response", {
      calloutSlug: callout.slug,
      calloutTitle: variant?.title || "Unknown title",
      responderName: responderName
    });
  }
}

export default new CalloutsService();

import {
  Authorized,
  Body,
  CurrentUser,
  Delete,
  Get,
  JsonController,
  NotFoundError,
  OnUndefined,
  Param,
  Patch,
  Post,
  QueryParams
} from "routing-controllers";
import { createQueryBuilder, getRepository } from "typeorm";

import PollsService from "@core/services/PollsService";

import ItemStatus, { ruleAsQuery } from "@models/ItemStatus";
import Member from "@models/Member";
import Poll from "@models/Poll";
import PollResponse from "@models/PollResponse";

import {
  CreateCalloutData,
  CreateCalloutResponseData,
  GetBasicCalloutData,
  GetCalloutResponseData,
  GetCalloutResponsesQuery,
  GetCalloutsQuery,
  GetMoreCalloutData,
  UpdateCalloutData
} from "@api/data/CalloutData";
import InvalidCalloutResponse from "@api/errors/InvalidCalloutResponse";
import { fetchPaginated, mergeRules, Paginated } from "@api/utils/pagination";

function pollToBasicCallout(poll: Poll): GetBasicCalloutData {
  return {
    slug: poll.slug,
    title: poll.title,
    excerpt: poll.excerpt,
    image: poll.image,
    allowUpdate: poll.allowUpdate,
    allowMultiple: poll.allowMultiple,
    access: poll.access,
    status: poll.status,
    hidden: poll.hidden,
    starts: poll.starts,
    expires: poll.expires,
    ...(poll.hasAnswered !== undefined && {
      hasAnswered: poll.hasAnswered
    })
  };
}

@JsonController("/callout")
export class CalloutController {
  @Get("/")
  async getCallouts(
    @CurrentUser() member: Member | undefined,
    @QueryParams() query: GetCalloutsQuery
  ): Promise<Paginated<GetBasicCalloutData>> {
    const scopedQuery = mergeRules(
      query,
      !member?.hasPermission("admin") && [
        // Non-admins can only query for open or ended non-hidden callouts
        {
          condition: "OR",
          rules: [
            { field: "status", operator: "equal", value: ItemStatus.Open },
            { field: "status", operator: "equal", value: ItemStatus.Ended }
          ]
        },
        { field: "hidden", operator: "equal", value: false }
      ]
    );

    const results = await fetchPaginated(Poll, scopedQuery, {
      // TODO: add validation errors
      status: ruleAsQuery,
      answeredBy: (rule, qb, suffix) => {
        if (rule.operator !== "equal" || !member) return;

        // TODO: allow admins to filter for other users
        if (rule.value !== "me" && rule.value !== member.id) return;

        // TODO: deduplicate with hasAnswered
        const subQb = createQueryBuilder()
          .subQuery()
          .select("pr.pollSlug", "slug")
          .distinctOn(["pr.pollSlug"])
          .from(PollResponse, "pr")
          .where(`pr.memberId = :id${suffix}`)
          .orderBy("pr.pollSlug");

        qb.where("item.slug IN " + subQb.getQuery());

        return {
          id: member.id
        };
      }
    });

    if (
      member &&
      results.items.length > 0 &&
      (query.hasAnswered === "me" || query.hasAnswered === member.id)
    ) {
      const answeredPolls = await createQueryBuilder(PollResponse, "pr")
        .select("pr.pollSlug", "slug")
        .distinctOn(["pr.pollSlug"])
        .where("pr.pollSlug IN (:...slugs) AND pr.memberId = :id", {
          slugs: results.items.map((item) => item.slug),
          id: member.id
        })
        .orderBy("pr.pollSlug")
        .getRawMany<{ slug: string }>();

      const answeredSlugs = answeredPolls.map((p) => p.slug);

      for (const item of results.items) {
        item.hasAnswered = answeredSlugs.includes(item.slug);
      }
    }

    return {
      ...results,
      items: results.items.map(pollToBasicCallout)
    };
  }

  @Authorized("admin")
  @Post("/")
  async createCallout(
    @Body() data: CreateCalloutData
  ): Promise<GetBasicCalloutData> {
    const poll = await getRepository(Poll).save(data);
    return pollToBasicCallout(poll);
  }

  @Get("/:slug")
  async getCallout(
    @Param("slug") slug: string
  ): Promise<GetMoreCalloutData | undefined> {
    const poll = await getRepository(Poll).findOne(slug);
    if (poll) {
      return {
        ...pollToBasicCallout(poll),
        intro: poll.intro,
        thanksText: poll.thanksText,
        thanksTitle: poll.thanksTitle,
        formSchema: poll.formSchema,
        ...(poll.thanksRedirect && { thanksRedirect: poll.thanksRedirect }),
        ...(poll.shareTitle && { shareTitle: poll.shareTitle }),
        ...(poll.shareDescription && {
          shareDescription: poll.shareDescription
        })
      };
    }
  }

  @Authorized("admin")
  @Patch("/:slug")
  async updateCallout(
    @Param("slug") slug: string,
    @Body() data: UpdateCalloutData
  ): Promise<GetMoreCalloutData | undefined> {
    await getRepository(Poll).update(slug, data);
    return this.getCallout(slug);
  }

  @Authorized("admin")
  @OnUndefined(204)
  @Delete("/:slug")
  async deleteCallout(@Param("slug") slug: string): Promise<void> {
    await getRepository(PollResponse).delete({ poll: { slug } });
    const result = await getRepository(Poll).delete(slug);
    if (result.affected === 0) {
      throw new NotFoundError();
    }
  }

  @Get("/:slug/responses")
  async getCalloutResponses(
    @CurrentUser({ required: true }) member: Member,
    @Param("slug") slug: string,
    @QueryParams() query: GetCalloutResponsesQuery
  ): Promise<Paginated<GetCalloutResponseData>> {
    const scopedQuery = mergeRules(query, [
      { field: "poll", operator: "equal", value: slug },
      // Member's can only see their own responses
      !member.hasPermission("admin") && {
        field: "member",
        operator: "equal",
        value: member.id
      }
    ]);
    const results = await fetchPaginated(
      PollResponse,
      scopedQuery,
      {
        member: (rule, qb, suffix, namedWhere) => {
          qb.where(`item.member ${namedWhere}`);
          if (rule.value === "me") {
            return { a: member.id };
          }
        }
      },
      (qb) => qb.loadAllRelationIds()
    );

    return {
      ...results,
      items: results.items.map((item) => ({
        member: item.member as unknown as string, // TODO: fix typing
        answers: item.answers,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt
      }))
    };
  }

  @Post("/:slug/responses")
  @OnUndefined(204)
  async createCalloutResponse(
    @CurrentUser({ required: false }) member: Member | undefined,
    @Param("slug") slug: string,
    @Body() data: CreateCalloutResponseData
  ) {
    const poll = await getRepository(Poll).findOne(slug);
    if (!poll) {
      throw new NotFoundError();
    }

    if (member && (data.guestEmail || data.guestName)) {
      throw new InvalidCalloutResponse("logged-in-guest-fields");
    }

    const error = member
      ? await PollsService.setResponse(poll, member, data.answers)
      : await PollsService.setGuestResponse(
          poll,
          data.guestName,
          data.guestEmail,
          data.answers
        );

    if (error) {
      throw new InvalidCalloutResponse(error);
    }
  }
}

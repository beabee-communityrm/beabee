import _ from "lodash";
import { createQueryBuilder, getRepository, SelectQueryBuilder } from "typeorm";

import { ContributionType } from "@core/utils";
import { Param } from "@core/utils/params";

import Member from "@models/Member";

import { ExportResult } from "./BaseExport";
import ActiveMembersExport from "./ActiveMembersExport";
import Poll from "@models/Poll";
import PollResponse from "@models/PollResponse";

import { convertAnswers } from "@apps/tools/apps/polls/app";

export default class EditionExport extends ActiveMembersExport {
  exportName = "Edition export";
  itemStatuses = ["added", "sent"];
  itemName = "members";
  idColumn = "m.id";

  async getParams(): Promise<Param[]> {
    const polls: [string, string][] = (
      await getRepository(Poll).find({ order: { date: "DESC" } })
    ).map((poll) => [poll.slug, poll.title]);

    return [
      {
        name: "monthlyAmountThreshold",
        label: "Monthly contribution amount threshold",
        type: "number"
      },
      {
        name: "includeNonOptIn",
        label: "Include those without delivery opt in",
        type: "boolean"
      },
      {
        name: "pollSlug",
        label: "Include answers from a poll?",
        type: "select",
        values: [["", ""], ...polls]
      }
    ];
  }

  protected get query(): SelectQueryBuilder<Member> {
    return createQueryBuilder(Member, "m")
      .innerJoinAndSelect("m.profile", "profile")
      .orderBy({
        firstname: "ASC",
        lastname: "ASC"
      });
  }

  protected getNewItemsQuery(): SelectQueryBuilder<Member> {
    const query = super
      .getNewItemsQuery()
      .andWhere("m.contributionMonthlyAmount >= :amount")
      .setParameters({
        now: new Date(),
        amount: this.ex!.params?.monthlyAmountThreshold || 3
      });

    if (!this.ex!.params?.includeNonOptIn) {
      query.andWhere("profile.deliveryOptIn = TRUE");
    }

    return query;
  }

  async getExport(members: Member[]): Promise<ExportResult> {
    let latestResponseByMember: Record<
      string,
      WithRelationIds<PollResponse, "member">
    > = {};
    if (this.ex?.params?.pollSlug) {
      const responses = (await createQueryBuilder(PollResponse, "pr")
        .where("pr.pollSlug = :pollSlug", {
          pollSlug: this.ex.params.pollSlug
        })
        .innerJoinAndSelect("pr.poll", "poll")
        .loadAllRelationIds({ relations: ["member"] })
        .orderBy("pr.updatedAt")
        .getMany()) as unknown as WithRelationIds<PollResponse, "member">[];

      for (const response of responses) {
        latestResponseByMember[response.member] = response;
      }
    }

    return members.map((member) => {
      const deliveryAddress = member.profile.deliveryAddress || {
        line1: "",
        line2: "",
        city: "",
        postcode: ""
      };
      const response = latestResponseByMember[member.id];

      return {
        EmailAddress: member.email,
        FirstName: member.firstname,
        LastName: member.lastname,
        Address1: deliveryAddress.line1,
        Address2: deliveryAddress.line2,
        City: deliveryAddress.city,
        Postcode: deliveryAddress.postcode.trim().toUpperCase(),
        ReferralCode: member.referralCode,
        IsGift: member.contributionType === ContributionType.Gift,
        ContributionMonthlyAmount: member.contributionMonthlyAmount,
        ...(response && convertAnswers(response.poll, response.answers))
      };
    });
  }
}

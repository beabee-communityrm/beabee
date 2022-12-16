import { ContributionType } from "@beabee/beabee-common";
import _ from "lodash";
import { createQueryBuilder, getRepository, SelectQueryBuilder } from "typeorm";

import { Param } from "@core/utils/params";
import { convertAnswers } from "@core/utils/callouts";

import Callout from "@models/Callout";
import CalloutResponse from "@models/CalloutResponse";
import Contact from "@models/Contact";

import { ExportResult } from "./BaseExport";
import ActiveMembersExport from "./ActiveMembersExport";

export default class EditionExport extends ActiveMembersExport {
  exportName = "Edition export";
  itemStatuses = ["added", "sent"];
  itemName = "members";
  idColumn = "m.id";

  async getParams(): Promise<Param[]> {
    const callouts: [string, string][] = (
      await getRepository(Callout).find({ order: { date: "DESC" } })
    ).map((callout) => [callout.slug, callout.title]);

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
        values: [["", ""], ...callouts]
      }
    ];
  }

  protected get query(): SelectQueryBuilder<Contact> {
    return createQueryBuilder(Contact, "m")
      .innerJoinAndSelect("m.profile", "profile")
      .orderBy({
        firstname: "ASC",
        lastname: "ASC"
      });
  }

  protected getNewItemsQuery(): SelectQueryBuilder<Contact> {
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

  async getExport(contacts: Contact[]): Promise<ExportResult> {
    let latestResponseByContact: Record<
      string,
      WithRelationIds<CalloutResponse, "contact">
    > = {};
    if (this.ex?.params?.pollSlug) {
      const responses = (await createQueryBuilder(CalloutResponse, "pr")
        .where("pr.calloutSlug = :calloutSlug", {
          calloutSlug: this.ex.params.pollSlug
        })
        .innerJoinAndSelect("pr.callout", "c")
        .loadAllRelationIds({ relations: ["contact"] })
        .orderBy("pr.updatedAt")
        .getMany()) as unknown as WithRelationIds<CalloutResponse, "contact">[];

      for (const response of responses) {
        latestResponseByContact[response.contact] = response;
      }
    }

    return contacts.map((contact) => {
      const deliveryAddress = contact.profile.deliveryAddress || {
        line1: "",
        line2: "",
        city: "",
        postcode: ""
      };
      const response = latestResponseByContact[contact.id];

      return {
        EmailAddress: contact.email,
        FirstName: contact.firstname,
        LastName: contact.lastname,
        Address1: deliveryAddress.line1,
        Address2: deliveryAddress.line2,
        City: deliveryAddress.city,
        Postcode: deliveryAddress.postcode.trim().toUpperCase(),
        ContributionMonthlyAmount: contact.contributionMonthlyAmount,
        ...(response && convertAnswers(response.callout, response.answers))
      };
    });
  }
}

import { Brackets, createQueryBuilder, SelectQueryBuilder } from "typeorm";

import { Param } from "@core/utils/params";

import PaymentData from "@models/PaymentData";
import Contact from "@models/Contact";

import BaseExport, { ExportResult } from "./BaseExport";

export default class ActiveMembersExport extends BaseExport<Contact> {
  exportName = "Active members export";
  itemStatuses = ["added", "seeen"];
  itemName = "active members";
  idColumn = "m.id";

  async getParams(): Promise<Param[]> {
    return [
      {
        name: "hasActiveSubscription",
        label: "Has active subscription",
        type: "boolean"
      }
    ];
  }

  protected get query(): SelectQueryBuilder<Contact> {
    return createQueryBuilder(Contact, "m").orderBy({
      firstname: "ASC",
      lastname: "ASC"
    });
  }

  protected getNewItemsQuery(): SelectQueryBuilder<Contact> {
    const query = super
      .getNewItemsQuery()
      .innerJoin("m.permissions", "mp")
      .andWhere("mp.permission = 'member' AND mp.dateAdded <= :now")
      .andWhere(
        new Brackets((qb) => {
          qb.where("mp.dateExpires IS NULL").orWhere("mp.dateExpires > :now");
        })
      )
      .setParameters({ now: new Date() });

    if (this.ex!.params?.hasActiveSubscription) {
      query
        .innerJoin(PaymentData, "pd", "pd.memberId = m.memberId")
        .andWhere("pd.data ->> 'subscriptionId' IS NOT NULL");
    }

    return query;
  }

  async getExport(members: Contact[]): Promise<ExportResult> {
    return members.map((member) => ({
      Id: member.id,
      EmailAddress: member.email,
      FirstName: member.firstname,
      LastName: member.lastname,
      ReferralCode: member.referralCode,
      PollsCode: member.pollsCode,
      ContributionType: member.contributionType,
      ContributionMonthlyAmount: member.contributionMonthlyAmount,
      ContributionPeriod: member.contributionPeriod,
      ContributionDescription: member.contributionDescription
    }));
  }
}

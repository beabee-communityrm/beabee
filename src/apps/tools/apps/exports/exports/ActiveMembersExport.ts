import { Brackets, SelectQueryBuilder } from "typeorm";

import { createQueryBuilder } from "@core/database";
import { Param } from "@core/utils/params";

import ContactContribution from "@models/ContactContribution";
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
      .innerJoin("m.roles", "mp")
      .innerJoinAndSelect(
        ContactContribution,
        "contribution",
        "contribution.contactId = m.id AND contribution.status = 'current'"
      )
      .andWhere("mp.type = 'member' AND mp.dateAdded <= :now")
      .andWhere(
        new Brackets((qb) => {
          qb.where("mp.dateExpires IS NULL").orWhere("mp.dateExpires > :now");
        })
      )
      .setParameters({ now: new Date() });

    if (this.ex!.params?.hasActiveSubscription) {
      query.andWhere("contribution.subscriptionId IS NOT NULL");
    }

    return query;
  }

  async getExport(contacts: Contact[]): Promise<ExportResult> {
    return contacts.map((contact) => ({
      Id: contact.id,
      EmailAddress: contact.email,
      FirstName: contact.firstname,
      LastName: contact.lastname,
      ReferralCode: contact.referralCode,
      PollsCode: contact.pollsCode,
      ContributionType: contact.contribution.method,
      ContributionMonthlyAmount: contact.contribution.monthlyAmount,
      ContributionPeriod: contact.contribution.period,
      ContributionDescription: contact.contribution.description
    }));
  }
}

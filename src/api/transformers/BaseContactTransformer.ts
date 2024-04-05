import { ContactFilterName, contactFilters } from "@beabee/beabee-common";
import { Brackets } from "typeorm";

import { createQueryBuilder } from "@core/database";

import { BaseTransformer } from "@api/transformers/BaseTransformer";

import Contact from "@models/Contact";
import ContactProfile from "@models/ContactProfile";
import ContactRole from "@models/ContactRole";
import PaymentData from "@models/PaymentData";

import { FilterHandler, FilterHandlers } from "@type/filter-handlers";

export abstract class BaseContactTransformer<
  GetDto,
  GetOptsDto
> extends BaseTransformer<Contact, GetDto, ContactFilterName, GetOptsDto> {
  protected model = Contact;
  protected filters = contactFilters;
  protected filterHandlers: FilterHandlers<ContactFilterName> = {
    deliveryOptIn: profileField("deliveryOptIn"),
    newsletterStatus: profileField("newsletterStatus"),
    tags: profileField("tags"),
    activePermission,
    activeMembership: activePermission,
    membershipStarts: membershipField("dateAdded"),
    membershipExpires: membershipField("dateExpires"),
    contributionCancelled: paymentDataField("cancelledAt"),
    manualPaymentSource: (qb, args) => {
      paymentDataField("data ->> 'source'")(qb, args);
      qb.andWhere(`${args.fieldPrefix}contributionType = 'Manual'`);
    }
  };
}

// Field handlers

function membershipField(field: keyof ContactRole): FilterHandler {
  return (qb, args) => {
    const subQb = createQueryBuilder()
      .subQuery()
      .select(`cr.contactId`)
      .from(ContactRole, "cr")
      .where(`cr.type = 'member'`)
      .andWhere(args.whereFn(`cr.${field}`));

    qb.where(`${args.fieldPrefix}id IN ${subQb.getQuery()}`);
  };
}

function profileField(field: keyof ContactProfile): FilterHandler {
  return (qb, args) => {
    const subQb = createQueryBuilder()
      .subQuery()
      .select(`profile.contactId`)
      .from(ContactProfile, "profile")
      .where(args.whereFn(`profile.${field}`));

    qb.where(`${args.fieldPrefix}id IN ${subQb.getQuery()}`);
  };
}

const activePermission: FilterHandler = (qb, args) => {
  const roleType = args.field === "activeMembership" ? "member" : args.value[0];

  const isIn =
    args.field === "activeMembership"
      ? (args.value[0] as boolean)
      : args.operator === "equal";

  const subQb = createQueryBuilder()
    .subQuery()
    .select(`cr.contactId`)
    .from(ContactRole, "cr")
    .where(`cr.type = '${roleType}'`)
    .andWhere(`cr.dateAdded <= :now`)
    .andWhere(
      new Brackets((qb) => {
        qb.where(`cr.dateExpires IS NULL`).orWhere(`cr.dateExpires > :now`);
      })
    );

  if (isIn) {
    qb.where(`${args.fieldPrefix}id IN ${subQb.getQuery()}`);
  } else {
    qb.where(`${args.fieldPrefix}id NOT IN ${subQb.getQuery()}`);
  }
};

function paymentDataField(field: string): FilterHandler {
  return (qb, args) => {
    const subQb = createQueryBuilder()
      .subQuery()
      .select(`pd.contactId`)
      .from(PaymentData, "pd")
      .where(args.whereFn(`pd.${field}`));

    qb.where(`${args.fieldPrefix}id IN ${subQb.getQuery()}`);
  };
}

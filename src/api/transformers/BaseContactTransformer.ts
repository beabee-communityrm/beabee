import {
  ContactFilterName,
  Filters,
  PaginatedQuery,
  Rule,
  RuleGroup,
  contactFilters,
  getCalloutFilters,
  isRuleGroup
} from "@beabee/beabee-common";
import { Brackets } from "typeorm";

import { createQueryBuilder, getRepository } from "@core/database";

import { BaseTransformer } from "@api/transformers/BaseTransformer";

import Contact from "@models/Contact";
import ContactProfile from "@models/ContactProfile";
import ContactRole from "@models/ContactRole";
import PaymentData from "@models/PaymentData";

import { FilterHandler, FilterHandlers } from "@type/filter-handlers";
import Callout from "@models/Callout";
import { isUUID } from "class-validator";
import { individualAnswerFilterHandler } from "./BaseCalloutResponseTransformer";
import CalloutResponse from "@models/CalloutResponse";

function flattenRules(rules: RuleGroup): Rule[] {
  return rules.rules.flatMap((rule) =>
    isRuleGroup(rule) ? flattenRules(rule) : rule
  );
}

export abstract class BaseContactTransformer<
  GetDto,
  GetOptsDto
> extends BaseTransformer<Contact, GetDto, ContactFilterName, GetOptsDto> {
  protected model = Contact;
  protected filters: Filters<ContactFilterName> = contactFilters;

  // TODO: should be protected once SegmentService is refactored
  filterHandlers: FilterHandlers<string> = {
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

  protected async transformFilters(
    query: GetOptsDto & PaginatedQuery
  ): Promise<[Partial<Filters<ContactFilterName>>, FilterHandlers<string>]> {
    const rules = query.rules ? flattenRules(query.rules) : [];

    // Load callouts referenced in a filter
    const calloutIds = rules
      .filter((r) => r.field.startsWith("callouts."))
      .map((r) => {
        const [_, calloutId] = r.field.split(".", 2);
        return calloutId;
      })
      .filter((v, i, a) => a.indexOf(v) === i)
      .filter((id) => isUUID(id));

    const filters: Partial<Filters> = {};
    for (const calloutId of calloutIds) {
      const callout = await getRepository(Callout).findOneBy({ id: calloutId });
      if (callout) {
        const calloutFilters = getCalloutFilters(callout.formSchema);
        for (const key in calloutFilters) {
          filters[`callouts.${calloutId}.responses.${key}`] =
            calloutFilters[key];
        }
      }
    }

    return [filters, { "callouts.": calloutResponseFilterHandler }];
  }
}

// Field handlers

function membershipField(field: keyof ContactRole): FilterHandler {
  return (qb, { fieldPrefix, convertToWhereClause }) => {
    const subQb = createQueryBuilder()
      .subQuery()
      .select(`cr.contactId`)
      .from(ContactRole, "cr")
      .where(`cr.type = 'member'`)
      .andWhere(convertToWhereClause(`cr.${field}`));

    qb.where(`${fieldPrefix}id IN ${subQb.getQuery()}`);
  };
}

function profileField(field: keyof ContactProfile): FilterHandler {
  return (qb, { fieldPrefix, convertToWhereClause }) => {
    const subQb = createQueryBuilder()
      .subQuery()
      .select(`profile.contactId`)
      .from(ContactProfile, "profile")
      .where(convertToWhereClause(`profile.${field}`));

    qb.where(`${fieldPrefix}id IN ${subQb.getQuery()}`);
  };
}

function paymentDataField(field: string): FilterHandler {
  return (qb, { fieldPrefix, convertToWhereClause }) => {
    const subQb = createQueryBuilder()
      .subQuery()
      .select(`pd.contactId`)
      .from(PaymentData, "pd")
      .where(convertToWhereClause(`pd.${field}`));

    qb.where(`${fieldPrefix}id IN ${subQb.getQuery()}`);
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

const calloutResponseFilterHandler: FilterHandler = (qb, args) => {
  // Split out callouts.<id>.responses.<answerFields...>
  const [, calloutId, , ...answerFields] = args.field.split(".");

  const subQb = createQueryBuilder()
    .subQuery()
    .select("item.contactId")
    .from(CalloutResponse, "item");

  const answerParams = individualAnswerFilterHandler(subQb, {
    ...args,
    field: answerFields.join(".")
  });

  subQb.andWhere(args.addParamSuffix(`item.calloutId = :calloutId`));

  qb.where(`${args.fieldPrefix}id IN ${subQb.getQuery()}`);

  return { calloutId, ...answerParams };
};

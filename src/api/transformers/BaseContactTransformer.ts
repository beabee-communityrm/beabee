import {
  ContactFilterName,
  Filters,
  PaginatedQuery,
  Rule,
  RuleGroup,
  contactCalloutFilters,
  contactFilters,
  getCalloutFilters,
  isRuleGroup
} from "@beabee/beabee-common";
import { isUUID } from "class-validator";
import { Brackets } from "typeorm";

import { createQueryBuilder, getRepository } from "@core/database";

import { individualAnswerFilterHandler } from "@api/transformers/BaseCalloutResponseTransformer";
import { BaseTransformer } from "@api/transformers/BaseTransformer";
import { prefixKeys } from "@api/utils";

import Callout from "@models/Callout";
import CalloutResponse from "@models/CalloutResponse";
import Contact from "@models/Contact";
import ContactProfile from "@models/ContactProfile";
import ContactRole from "@models/ContactRole";
import ContactContribution from "@models/ContactContribution";

import { FilterHandler, FilterHandlers } from "@type/filter-handlers";

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
    contributionCancelled: contributionField("cancelledAt"),
    manualPaymentSource: (qb, args) => {
      contributionField("mandateId")(qb, args);
      // TODO
      // qb.andWhere(`${args.fieldPrefix}contributionType = 'Manual'`);
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
        Object.assign(
          filters,
          prefixKeys(`callouts.${calloutId}.`, contactCalloutFilters),
          prefixKeys(
            `callouts.${calloutId}.responses.`,
            getCalloutFilters(callout.formSchema)
          )
        );
      }
    }

    return [filters, { "callouts.": calloutsFilterHandler }];
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

function contributionField(field: keyof ContactContribution): FilterHandler {
  return (qb, { fieldPrefix, convertToWhereClause }) => {
    const subQb = createQueryBuilder()
      .subQuery()
      .select(`cc.contactId`)
      .from(ContactContribution, "cc")
      .where("cc.status = 'current'")
      .andWhere(convertToWhereClause(`cc.${field}`));

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

const calloutsFilterHandler: FilterHandler = (qb, args) => {
  // Split out callouts.<id>.<filterName>[.<answerFields...>]
  const [, calloutId, subField, ...answerFields] = args.field.split(".");

  let params;

  switch (subField) {
    /**
     * Filter contacts by their answers to a callout, uses the same filters as
     * callout responses endpoints

     * Filter field: callout.<id>.responses.<answerFields>
     */
    case "responses": {
      const subQb = createQueryBuilder()
        .subQuery()
        .select("item.contactId")
        .from(CalloutResponse, "item");

      params = individualAnswerFilterHandler(subQb, {
        ...args,
        field: answerFields.join(".")
      });

      subQb
        .andWhere(args.addParamSuffix("item.calloutId = :calloutId"))
        .andWhere("item.contactId IS NOT NULL");

      qb.where(`${args.fieldPrefix}id IN ${subQb.getQuery()}`);
      break;
    }

    /**
     * Filter contacts by whether they have answered a callout
     *
     * Filter field: callout.<id>.hasAnswered
     */
    case "hasAnswered": {
      const subQb = createQueryBuilder()
        .subQuery()
        .select("item.contactId")
        .from(CalloutResponse, "item")
        .where(args.addParamSuffix(`item.calloutId = :calloutId`))
        .andWhere("item.contactId IS NOT NULL");

      const operator = args.value[0] ? "IN" : "NOT IN";

      qb.where(`${args.fieldPrefix}id ${operator} ${subQb.getQuery()}`);
      break;
    }
  }

  return { calloutId, ...params };
};

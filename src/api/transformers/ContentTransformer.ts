import { plainToInstance } from "class-transformer";

import { createQueryBuilder, getRepository } from "@core/database";
import { getEmailFooter } from "@core/utils/email";

import OptionsService, { OptionKey } from "@core/services/OptionsService";
import {
  GetContentContactsDto,
  GetContentDto,
  GetContentEmailDto,
  GetContentGeneralDto,
  GetContentJoinDto,
  GetContentJoinSetupDto,
  GetContentProfileDto,
  GetContentShareDto,
  GetContentPaymentDto
} from "@api/dto/ContentDto";

import Content from "@models/Content";

import config from "@config";

import { ContentId } from "@type/content-id";
import { ContentData } from "@type/content-data";

class ContentTransformer {
  convert<Id extends ContentId>(
    id: Id,
    data: ContentData<Id>
  ): GetContentDto<Id> {
    const Dto = {
      contacts: GetContentContactsDto,
      email: GetContentEmailDto,
      general: GetContentGeneralDto,
      join: GetContentJoinDto,
      "join/setup": GetContentJoinSetupDto,
      profile: GetContentProfileDto,
      share: GetContentShareDto,
      payment: GetContentPaymentDto
    }[id];

    return plainToInstance(Dto as any, data);
  }

  async fetchOne<Id extends ContentId>(id: Id): Promise<GetContentDto<Id>> {
    const content = await getRepository(Content).findOneBy({ id });

    const ret: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(contentData[id])) {
      switch (value[0]) {
        case "data":
          ret[key] = content?.data[key] || value[1];
          break;
        case "option":
          ret[key] = OptionsService[optTypeGetter[value[2]]](value[1]);
          break;
        case "readonly":
          ret[key] = value[1]();
          break;
      }
    }

    return this.convert(id, ret as any);
  }

  async updateOne<Id extends ContentId>(
    id: Id,
    data_: Partial<ContentData<Id>>
  ): Promise<void> {
    const optionUpdates: Partial<Record<OptionKey, string | boolean | number>> =
      {};
    const dataUpdates: Record<string, unknown> = {};

    const data = data_ as Record<string, unknown>;

    for (const [key, value] of Object.entries(contentData[id])) {
      if (data[key] === undefined) {
        continue;
      }

      switch (value[0]) {
        case "data":
          dataUpdates[key] = data[key];
          break;
        case "option":
          const optValue = optTypeSetter[value[2]](data[key]);
          if (optValue !== undefined) {
            optionUpdates[value[1]] = optValue;
          }
          break;
      }
    }

    await OptionsService.set(optionUpdates);

    // Save the rest
    await createQueryBuilder()
      .update(Content)
      .set({
        data: () => '"data" || :data::jsonb'
      })
      .where("id = :id")
      .setParameters({ id, data: dataUpdates })
      .execute();
  }
}

type OptionKeyType = "text" | "int" | "bool" | "list" | "json";

const optTypeGetter = {
  text: "getText",
  int: "getInt",
  bool: "getBool",
  list: "getList",
  json: "getJSON"
} as const;

const optTypeSetter = {
  text: (s: any) => (typeof s === "string" ? s : undefined),
  int: (s: any) => (typeof s === "number" ? s : undefined),
  bool: (s: any) => (typeof s === "boolean" ? s : undefined),
  list: (s: any) => (Array.isArray(s) ? s.join(",") : undefined),
  json: (s: any) => JSON.stringify(s)
} as const;

type ContentValueOption = [
  type: "option",
  key: OptionKey,
  keyType: OptionKeyType
];
type ContentValueReadOnly = [type: "readonly", getter: () => unknown];
type ContentValueData = [type: "data", def: unknown];

type ContentValue =
  | ContentValueOption
  | ContentValueReadOnly
  | ContentValueData;

// Just here for type checking
function withValue<Id extends ContentId>(
  data: Record<keyof ContentData<Id>, ContentValue>
): Record<keyof ContentData<Id>, ContentValue> {
  return data;
}

const contentData = {
  contacts: withValue<"contacts">({
    tags: ["option", "available-tags", "list"],
    manualPaymentSources: ["option", "available-manual-payment-sources", "list"]
  }),
  email: withValue<"email">({
    footer: ["readonly", getEmailFooter],
    supportEmail: ["option", "support-email", "text"],
    supportEmailName: ["option", "support-email-from", "text"]
  }),
  general: withValue<"general">({
    backgroundUrl: ["data", ""],
    currencyCode: ["readonly", () => config.currencyCode],
    currencySymbol: ["readonly", () => config.currencySymbol],
    footerLinks: ["data", []],
    hideContribution: ["data", false],
    logoUrl: ["option", "logo", "text"],
    organisationName: ["option", "organisation", "text"],
    siteUrl: ["option", "home-link-url", "text"],
    supportEmail: ["option", "support-email", "text"],
    theme: ["option", "theme", "json"],
    termsLink: ["option", "footer-terms-link-url", "text"],
    privacyLink: ["option", "footer-privacy-link-url", "text"],
    impressumLink: ["option", "footer-impressum-link-url", "text"],
    locale: ["option", "locale", "text"]
  }),
  join: withValue<"join">({
    initialAmount: ["data", 0],
    initialPeriod: ["data", ""],
    minMonthlyAmount: ["option", "contribution-min-monthly-amount", "int"],
    periods: ["data", []],
    paymentMethods: ["data", []],
    showAbsorbFee: ["option", "show-absorb-fee", "bool"],
    showNoContribution: ["data", false],
    stripeCountry: ["readonly", () => config.stripe.country],
    stripePublicKey: ["readonly", () => config.stripe.publicKey],
    subtitle: ["data", ""],
    title: ["data", ""]
  }),
  "join/setup": withValue<"join/setup">({
    mailOptIn: ["data", ""],
    mailText: ["data", ""],
    mailTitle: ["data", ""],
    newsletterOptIn: ["data", ""],
    newsletterText: ["data", ""],
    newsletterTitle: ["data", ""],
    showMailOptIn: ["option", "show-mail-opt-in", "bool"],
    showNewsletterOptIn: ["data", false],
    surveyRequired: ["data", false],
    surveySlug: ["option", "join-survey", "text"],
    surveyText: ["data", ""],
    welcome: ["data", ""]
  }),
  profile: withValue<"profile">({
    introMessage: ["data", ""]
  }),
  share: withValue<"share">({
    description: ["option", "share-description", "text"],
    image: ["option", "share-image", "text"],
    title: ["option", "share-title", "text"],
    twitterHandle: ["option", "share-twitter-handle", "text"]
  }),
  payment: withValue<"payment">({
    stripePublicKey: ["readonly", () => config.stripe.publicKey],
    stripeCountry: ["readonly", () => config.stripe.country],
    taxRateEnabled: ["option", "tax-rate-enabled", "bool"],
    taxRate: ["option", "tax-rate-percentage", "int"]
  })
} as const;

export default new ContentTransformer();

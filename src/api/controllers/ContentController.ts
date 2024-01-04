import {
  Authorized,
  Body,
  Get,
  JsonController,
  Param,
  Patch
} from "routing-controllers";

import OptionsService, { OptionKey } from "@core/services/OptionsService";

import { createQueryBuilder, getRepository } from "@core/database";
import { getEmailFooter } from "@core/utils/email";

import Content from "@models/Content";
import config from "@config";

import { ContentId } from "@type/content-id";

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

type ContentMap<T extends any[]> = Partial<Record<ContentId, [string, ...T][]>>;

const contentOptions: ContentMap<[OptionKey, OptionKeyType]> = {
  general: [
    ["organisationName", "organisation", "text"],
    ["logoUrl", "logo", "text"],
    ["siteUrl", "home-link-url", "text"],
    ["supportEmail", "support-email", "text"],
    ["privacyLink", "footer-privacy-link-url", "text"],
    ["termsLink", "footer-terms-link-url", "text"],
    ["impressumLink", "footer-impressum-link-url", "text"],
    ["locale", "locale", "text"],
    ["theme", "theme", "json"]
  ],
  join: [
    ["minMonthlyAmount", "contribution-min-monthly-amount", "int"],
    ["showAbsorbFee", "show-absorb-fee", "bool"]
  ],
  "join/setup": [
    ["showMailOptIn", "show-mail-opt-in", "bool"],
    ["surveySlug", "join-survey", "text"]
  ],
  contacts: [
    ["tags", "available-tags", "list"],
    ["manualPaymentSources", "available-manual-payment-sources", "list"]
  ],
  share: [
    ["title", "share-title", "text"],
    ["description", "share-description", "text"],
    ["image", "share-image", "text"],
    ["twitterHandle", "share-twitter-handle", "text"]
  ],
  email: [
    ["supportEmail", "support-email", "text"],
    ["supportEmailName", "support-email-from", "text"]
  ]
};

const contentReadOnly: ContentMap<[() => any]> = {
  general: [
    ["currencyCode", () => config.currencyCode],
    ["currencySymbol", () => config.currencySymbol]
  ],
  email: [["footer", getEmailFooter]],
  join: [
    ["stripePublicKey", () => config.stripe.publicKey],
    ["stripeCountry", () => config.stripe.country]
  ]
};

@JsonController("/content")
export class ContentController {
  @Get("/:id(*)")
  async get(@Param("id") id: ContentId): Promise<object | undefined> {
    const content = await getRepository(Content).findOneBy({ id });

    if (content) {
      const optsData = contentOptions[id]?.map(
        ([contentKey, optKey, optType]) => [
          contentKey,
          OptionsService[optTypeGetter[optType]](optKey)
        ]
      );
      const readOnlyData = contentReadOnly[id]?.map(
        ([contentKey, contentFn]) => [contentKey, contentFn()]
      );

      return {
        ...content.data,
        ...(optsData && Object.fromEntries(optsData)),
        ...(readOnlyData && Object.fromEntries(readOnlyData))
      };
    }
  }

  @Authorized("admin")
  @Patch("/:id(*)")
  async update(
    @Param("id") id: ContentId,
    @Body() data: any
  ): Promise<object | undefined> {
    // Update options
    const options = contentOptions[id];
    if (options) {
      const optData = options
        .map(([contentKey, optKey, optType]) => {
          const { [contentKey]: contentValue, ...restData } = data;
          data = restData; // Remove entry from data
          return [optKey, optTypeSetter[optType](contentValue)];
        })
        .filter(([optKey, optValue]) => optValue !== undefined);
      await OptionsService.set(Object.fromEntries(optData));
    }

    // Save the rest
    await createQueryBuilder()
      .update(Content)
      .set({
        data: () => '"data" || :data::jsonb'
      })
      .where("id = :id")
      .setParameters({ id, data })
      .execute();

    return await this.get(id);
  }
}

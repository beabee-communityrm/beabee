import { plainToInstance } from "class-transformer";

import { createQueryBuilder, getRepository } from "@core/database";
import { getEmailFooter } from "@core/utils/email";

import OptionsService, { OptionKey } from "@core/services/OptionsService";
import {
  GetContactsContentDto,
  GetContentDto,
  GetEmailContentDto,
  GetGeneralContentDto,
  GetJoinContentDto,
  GetJoinSetupContentDto,
  GetProfileContentDto,
  GetShareContentDto
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
      contacts: GetContactsContentDto,
      email: GetEmailContentDto,
      general: GetGeneralContentDto,
      join: GetJoinContentDto,
      "join/setup": GetJoinSetupContentDto,
      profile: GetProfileContentDto,
      share: GetShareContentDto
    }[id];

    return plainToInstance(Dto as any, data);
  }

  async fetchOne<Id extends ContentId>(id: Id): Promise<GetContentDto<Id>> {
    const content = await getRepository(Content).findOneByOrFail({ id });

    const optsData = contentOptions[id]?.map(
      ([contentKey, optKey, optType]) => [
        contentKey,
        OptionsService[optTypeGetter[optType]](optKey)
      ]
    );
    const readOnlyData = contentReadOnly[id]?.map(([contentKey, contentFn]) => [
      contentKey,
      contentFn()
    ]);

    return this.convert(id, {
      ...content.data,
      ...(optsData && Object.fromEntries(optsData)),
      ...(readOnlyData && Object.fromEntries(readOnlyData))
    });
  }

  async updateOne<Id extends ContentId>(
    id: Id,
    data: Partial<ContentData<Id>>
  ): Promise<void> {
    // Update options
    const options = contentOptions[id];
    if (options) {
      const optionUpdates: Partial<
        Record<OptionKey, string | boolean | number>
      > = {};

      for (const [contentKey, optKey, optType] of options) {
        const {
          [contentKey as keyof ContentData<Id>]: contentValue,
          ...restData
        } = data;
        data = restData as Partial<ContentData<Id>>; // Remove entry from data

        const optValue = optTypeSetter[optType](contentValue);
        if (optValue !== undefined) {
          optionUpdates[optKey] = optValue;
        }
      }

      await OptionsService.set(optionUpdates);
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

export default new ContentTransformer();

import {
  Authorized,
  Body,
  Get,
  JsonController,
  Param,
  Put
} from "routing-controllers";
import { getRepository } from "typeorm";

import OptionsService from "@core/services/OptionsService";
import { getEmailFooter } from "@core/utils/email";

import Content, { ContentId } from "@models/Content";
import config from "@config";

const getExtraContent = {
  general: () => ({
    organisationName: OptionsService.getText("organisation"),
    siteUrl: OptionsService.getText("home-link-url"),
    supportEmail: OptionsService.getText("support-email"),
    privacyLink: OptionsService.getText("footer-privacy-link-url"),
    termsLink: OptionsService.getText("footer-terms-link-url"),
    impressumLink: OptionsService.getText("footer-impressum-link-url"),
    currencyCode: config.currencyCode,
    theme: OptionsService.getJSON("theme")
  }),
  join: () => ({
    minMonthlyAmount: OptionsService.getInt("contribution-min-monthly-amount"),
    showAbsorbFee: OptionsService.getBool("show-absorb-fee")
  }),
  "join/setup": () => ({
    showMailOptIn: OptionsService.getBool("show-mail-opt-in")
  }),
  profile: () => ({}),
  contacts: () => ({
    tags: OptionsService.getList("available-tags"),
    manualPaymentSources: OptionsService.getList(
      "available-manual-payment-sources"
    )
  })
} as const;

const saveExtraContent = {
  general: async (d: any) => {
    const {
      organisationName,
      siteUrl,
      supportEmail,
      privacyLink,
      termsLink,
      impressumLink,
      currencyCode,
      theme,
      ...data
    } = d;
    await OptionsService.set({
      organisation: organisationName,
      "home-link-url": siteUrl,
      "support-email": supportEmail,
      "footer-privacy-link-url": privacyLink,
      "footer-terms-link-url": termsLink,
      "footer-impressum-link-url": impressumLink,
      theme: JSON.stringify(theme)
    });
    return data;
  },
  join: async (d: any) => {
    const { minMonthlyAmount, showAbsorbFee, ...data } = d;
    await OptionsService.set({
      "show-absorb-fee": showAbsorbFee,
      "contribution-min-monthly-amount": minMonthlyAmount
    });
    return data;
  },
  "join/setup": async (d: any) => {
    const { showMailOptIn, ...data } = d;
    await OptionsService.set("show-mail-opt-in", showMailOptIn);
    return data;
  },
  profile: (d: any) => d,
  contacts: async (d: any) => {
    const { tags, manualPaymentSources, ...data } = d;
    await OptionsService.set({
      "available-tags": tags.join(","),
      "available-manual-payment-sources": manualPaymentSources.join(",")
    });
    return data;
  }
} as const;

@JsonController("/content")
export class ContentController {
  @Get("/email")
  getEmail(): object {
    return {
      footer: getEmailFooter()
    };
  }

  @Get("/:id(*)")
  async get(@Param("id") id: ContentId): Promise<object | undefined> {
    const content = await getRepository(Content).findOne(id);
    if (content) {
      return { ...content.data, ...getExtraContent[id]() };
    }
  }

  @Authorized("admin")
  @Put("/:id(*)")
  async update(
    @Param("id") id: ContentId,
    @Body() data: any
  ): Promise<object | undefined> {
    const actualData = await saveExtraContent[id](data);
    await getRepository(Content).update(id, { data: actualData });
    return await this.get(id);
  }
}

import { Get, JsonController, Param } from "routing-controllers";
import { getRepository } from "typeorm";

import OptionsService from "@core/services/OptionsService";

import Content, { ContentId } from "@models/Content";
import config from "@config";

const extraContent = {
  general: () => ({
    name: OptionsService.getText("organisation"),
    siteUrl: OptionsService.getText("home-link-url"),
    supportEmail: OptionsService.getText("support-email"),
    privacyLink: OptionsService.getText("footer-privacy-link-url"),
    termsLink: OptionsService.getText("footer-terms-link-url"),
    currencyCode: config.currencyCode
  }),
  join: () => ({
    minMonthlyAmount: OptionsService.getInt("contribution-min-monthly-amount"),
    showAbsorbFee: OptionsService.getBool("show-absorb-fee")
  }),
  "join/setup": () => ({
    showMailOptIn: OptionsService.getBool("show-mail-opt-in")
  }),
  profile: () => ({})
} as const;

@JsonController("/content")
export class ContentController {
  @Get("/:id(*)")
  async getId(@Param("id") id: ContentId): Promise<object | undefined> {
    const content = await getRepository(Content).findOne(id);
    if (content) {
      return { ...content.data, ...extraContent[id]() };
    }
  }
}

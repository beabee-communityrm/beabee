import { Get, JsonController, Param } from "routing-controllers";
import { getRepository } from "typeorm";

import OptionsService from "@core/services/OptionsService";

import Content, { ContentId } from "@models/Content";

const extraContent = {
  join: () => ({
    minMonthlyAmount: OptionsService.getInt("contribution-min-monthly-amount"),
    showAbsorbFee: OptionsService.getBool("show-absorb-fee"),
    privacyLink: OptionsService.getText("footer-privacy-link-url"),
    termsLink: OptionsService.getText("footer-terms-link-url"),
    name: OptionsService.getText("organisation")
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

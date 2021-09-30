import { Get, JsonController, Param } from "routing-controllers";
import { getRepository } from "typeorm";

import OptionsService from "@core/services/OptionsService";

import Content from "@models/Content";

import config from "@config";

@JsonController("/content")
export class ContentController {
  @Get("/:id(*)")
  async getId(@Param("id") id: string): Promise<object | undefined> {
    const content = await getRepository(Content).findOne(id);
    if (content && id === "join") {
      return {
        ...content.data,
        currencySymbol: config.currencySymbol,
        minMonthlyAmount: OptionsService.getInt(
          "contribution-min-monthly-amount"
        ),
        privacyLink: OptionsService.getText("footer-privacy-link-url"),
        termsLink: OptionsService.getText("footer-terms-link-url"),
        name: OptionsService.getText("organisation")
      };
    } else {
      return content?.data;
    }
  }
}

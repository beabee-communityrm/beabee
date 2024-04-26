import {
  Authorized,
  Body,
  Get,
  JsonController,
  Params,
  Patch,
  BadRequestError
} from "routing-controllers";

import PartialBody from "@api/decorators/PartialBody";
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
import { ContentParams } from "@api/params/ContentParams";
import ContentTransformer from "@api/transformers/ContentTransformer";
import { stripeTaxRateUpdateOrCreateDefault } from "@core/lib/stripe";
import OptionsService from "@core/services/OptionsService";

@JsonController("/content")
export class ContentController {
  @Get("/:id(?:*)")
  async get(@Params() { id }: ContentParams): Promise<GetContentDto> {
    return await ContentTransformer.fetchOne(id);
  }

  @Authorized("admin")
  @Patch("/contacts")
  async updateContacts(
    @PartialBody() data: GetContentContactsDto
  ): Promise<GetContentContactsDto> {
    await ContentTransformer.updateOne("contacts", data);
    return ContentTransformer.fetchOne("contacts");
  }

  @Authorized("admin")
  @Patch("/email")
  async updateEmail(
    @PartialBody() data: GetContentEmailDto
  ): Promise<GetContentEmailDto> {
    await ContentTransformer.updateOne("email", data);
    return ContentTransformer.fetchOne("email");
  }

  @Authorized("admin")
  @Patch("/general")
  async updateGeneral(
    @PartialBody() data: GetContentGeneralDto
  ): Promise<GetContentGeneralDto> {
    await ContentTransformer.updateOne("general", data);
    return ContentTransformer.fetchOne("general");
  }

  @Authorized("admin")
  @Patch("/join")
  async updateJoin(
    @PartialBody() data: GetContentJoinDto
  ): Promise<GetContentJoinDto> {
    await ContentTransformer.updateOne("join", data);
    return ContentTransformer.fetchOne("join");
  }

  @Authorized("admin")
  @Patch("/join/setup")
  async updateJoinSetup(
    @PartialBody() data: GetContentJoinSetupDto
  ): Promise<GetContentJoinSetupDto> {
    await ContentTransformer.updateOne("join/setup", data);
    return ContentTransformer.fetchOne("join/setup");
  }

  @Authorized("admin")
  @Patch("/profile")
  async updateProfile(
    @PartialBody() data: GetContentProfileDto
  ): Promise<GetContentProfileDto> {
    await ContentTransformer.updateOne("profile", data);
    return ContentTransformer.fetchOne("profile");
  }

  @Authorized("admin")
  @Patch("/share")
  async updateShare(
    @PartialBody() data: GetContentShareDto
  ): Promise<GetContentShareDto> {
    await ContentTransformer.updateOne("share", data);
    return ContentTransformer.fetchOne("share");
  }

  @Authorized("admin")
  @Patch("/payment")
  async updatePayment(
    @PartialBody() data: GetContentPaymentDto
  ): Promise<GetContentPaymentDto> {
    if (data.taxRate === undefined && data.taxRateEnabled === true) {
      throw new BadRequestError(
        "taxRate must be provided when taxRateEnabled is true"
      );
    }

    const taxRateObj = await stripeTaxRateUpdateOrCreateDefault(
      {
        active: data.taxRateEnabled,
        percentage: data.taxRate
      },
      OptionsService.getText("tax-rate-stripe-default-id")
    );
    await OptionsService.set("tax-rate-stripe-default-id", taxRateObj.id);

    await ContentTransformer.updateOne("payment", data);
    return ContentTransformer.fetchOne("payment");
  }
}

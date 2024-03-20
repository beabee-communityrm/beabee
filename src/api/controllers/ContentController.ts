import {
  Authorized,
  Body,
  Get,
  JsonController,
  Params,
  Patch
} from "routing-controllers";

import PartialBody from "#api/decorators/PartialBody";
import {
  GetContactsContentDto,
  GetContentDto,
  GetEmailContentDto,
  GetGeneralContentDto,
  GetJoinContentDto,
  GetJoinSetupContentDto,
  GetProfileContentDto,
  GetShareContentDto
} from "#api/dto/ContentDto";
import { ContentParams } from "#api/params/ContentParams";
import ContentTransformer from "#api/transformers/ContentTransformer";

@JsonController("/content")
export class ContentController {
  @Get("/:id(?:*)")
  async get(@Params() { id }: ContentParams): Promise<GetContentDto> {
    return await ContentTransformer.fetchOne(id);
  }

  @Authorized("admin")
  @Patch("/contacts")
  async updateContacts(
    @PartialBody() data: GetContactsContentDto
  ): Promise<GetContactsContentDto> {
    ContentTransformer.updateOne("contacts", data);
    return ContentTransformer.fetchOne("contacts");
  }

  @Authorized("admin")
  @Patch("/email")
  async updateEmail(
    @PartialBody() data: GetEmailContentDto
  ): Promise<GetEmailContentDto> {
    ContentTransformer.updateOne("email", data);
    return ContentTransformer.fetchOne("email");
  }

  @Authorized("admin")
  @Patch("/general")
  async updateGeneral(
    @PartialBody() data: GetGeneralContentDto
  ): Promise<GetGeneralContentDto> {
    ContentTransformer.updateOne("general", data);
    return ContentTransformer.fetchOne("general");
  }

  @Authorized("admin")
  @Patch("/join")
  async updateJoin(
    @PartialBody() data: GetJoinContentDto
  ): Promise<GetJoinContentDto> {
    ContentTransformer.updateOne("join", data);
    return ContentTransformer.fetchOne("join");
  }

  @Authorized("admin")
  @Patch("/join/setup")
  async updateJoinSetup(
    @PartialBody() data: GetJoinSetupContentDto
  ): Promise<GetJoinSetupContentDto> {
    ContentTransformer.updateOne("join/setup", data);
    return ContentTransformer.fetchOne("join/setup");
  }

  @Authorized("admin")
  @Patch("/profile")
  async updateProfile(
    @PartialBody() data: GetProfileContentDto
  ): Promise<GetProfileContentDto> {
    ContentTransformer.updateOne("profile", data);
    return ContentTransformer.fetchOne("profile");
  }

  @Authorized("admin")
  @Patch("/share")
  async updateShare(
    @PartialBody() data: GetShareContentDto
  ): Promise<GetShareContentDto> {
    ContentTransformer.updateOne("share", data);
    return ContentTransformer.fetchOne("share");
  }
}

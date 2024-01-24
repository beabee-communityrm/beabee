import {
  Authorized,
  Body,
  Delete,
  Get,
  JsonController,
  NotFoundError,
  OnUndefined,
  Params,
  Patch,
  Post,
  QueryParams
} from "routing-controllers";

import { getRepository } from "@core/database";

import { CurrentAuth } from "@api/decorators/CurrentAuth";
import PartialBody from "@api/decorators/PartialBody";
import {
  CreateNoticeDto,
  GetNoticeDto,
  ListNoticesDto
} from "@api/dto/NoticeDto";
import { PaginatedDto } from "@api/dto/PaginatedDto";
import { UUIDParams } from "@api/params/UUIDParams";
import NoticeTransformer from "@api/transformers/NoticeTransformer";

import Notice from "@models/Notice";

import { AuthInfo } from "@type/auth-info";

@JsonController("/notice")
@Authorized()
export class NoticeController {
  @Get("/")
  async getNotices(
    @CurrentAuth({ required: true }) auth: AuthInfo,
    @QueryParams() query: ListNoticesDto
  ): Promise<PaginatedDto<GetNoticeDto>> {
    return await NoticeTransformer.fetch(auth, query);
  }

  @Get("/:id")
  async getNotice(
    @CurrentAuth({ required: true }) auth: AuthInfo,
    @Params() { id }: UUIDParams
  ): Promise<GetNoticeDto | undefined> {
    return await NoticeTransformer.fetchOneById(auth, id);
  }

  @Post("/")
  @Authorized("admin")
  async createNotice(@Body() data: CreateNoticeDto): Promise<GetNoticeDto> {
    const notice = await getRepository(Notice).save(data);
    return NoticeTransformer.convert(notice);
  }

  @Patch("/:id")
  @Authorized("admin")
  async updateNotice(
    @CurrentAuth({ required: true }) auth: AuthInfo,
    @Params() { id }: UUIDParams,
    @PartialBody() data: CreateNoticeDto
  ): Promise<GetNoticeDto | undefined> {
    await getRepository(Notice).update(id, data);
    return await NoticeTransformer.fetchOneById(auth, id);
  }

  @OnUndefined(204)
  @Delete("/:id")
  @Authorized("admin")
  async deleteNotice(@Params() { id }: UUIDParams): Promise<void> {
    const result = await getRepository(Notice).delete(id);
    if (!result.affected) throw new NotFoundError();
  }
}

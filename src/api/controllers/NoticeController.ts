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
import { ResponseSchema } from "routing-controllers-openapi";

import { getRepository } from "@core/database";

import { CurrentAuth } from "@api/decorators/CurrentAuth";
import PartialBody from "@api/decorators/PartialBody";
import {
  CreateNoticeDto,
  GetNoticeDto,
  GetNoticeListDto,
  ListNoticesDto
} from "@api/dto/NoticeDto";
import { UUIDParams } from "@api/params/UUIDParams";
import NoticeTransformer from "@api/transformers/NoticeTransformer";

import Notice from "@models/Notice";

import { AuthInfo } from "@type/auth-info";

@JsonController("/notice")
@Authorized()
export class NoticeController {
  @Get("/")
  @ResponseSchema(GetNoticeListDto)
  async getNotices(
    @CurrentAuth({ required: true }) auth: AuthInfo,
    @QueryParams() query: ListNoticesDto
  ): Promise<GetNoticeListDto> {
    return await NoticeTransformer.fetch(auth, query);
  }

  @Get("/:id")
  @ResponseSchema(GetNoticeDto, { statusCode: 200 })
  async getNotice(
    @CurrentAuth({ required: true }) auth: AuthInfo,
    @Params() { id }: UUIDParams
  ): Promise<GetNoticeDto | undefined> {
    return await NoticeTransformer.fetchOneById(auth, id);
  }

  @Post("/")
  @Authorized("admin")
  @ResponseSchema(GetNoticeDto)
  async createNotice(@Body() data: CreateNoticeDto): Promise<GetNoticeDto> {
    const notice = await getRepository(Notice).save(data);
    return NoticeTransformer.convert(notice);
  }

  @Patch("/:id")
  @Authorized("admin")
  @ResponseSchema(GetNoticeDto, { statusCode: 200 })
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

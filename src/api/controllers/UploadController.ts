import { plainToInstance } from "class-transformer";
import { Request } from "express";
import {
  CurrentUser,
  Get,
  JsonController,
  NotFoundError,
  OnUndefined,
  Params,
  Post,
  Req
} from "routing-controllers";

import UploadFlowService from "@core/services/UploadFlowService";

import Contact from "@models/Contact";

import { GetUploadFlowDto } from "@api/dto/UploadFlowDto";
import BadRequestError from "@api/errors/BadRequestError";
import { UUIDParams } from "@api/params/UUIDParams";

@JsonController("/upload")
export class UploadController {
  @Post("/")
  async create(
    @CurrentUser({ required: false }) contact: Contact | undefined,
    @Req() req: Request
  ): Promise<GetUploadFlowDto> {
    if (!req.ip) {
      throw new BadRequestError();
    }

    const newUploadFlowId = await UploadFlowService.create(contact, req.ip);
    return plainToInstance(GetUploadFlowDto, { id: newUploadFlowId });
  }

  // This should be a POST request as it's not idempotent, but we use nginx's
  // auth_request directive to call this endpoint and it only does GET requests
  @Get("/:id")
  @OnUndefined(204)
  async get(@Params() { id }: UUIDParams): Promise<void> {
    if (!(await UploadFlowService.validate(id))) {
      throw new NotFoundError();
    }
  }
}

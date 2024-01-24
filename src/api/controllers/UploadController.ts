import { plainToInstance } from "class-transformer";
import { sub } from "date-fns";
import { Request } from "express";
import {
  CurrentUser,
  Get,
  HttpError,
  JsonController,
  NotFoundError,
  OnUndefined,
  Params,
  Post,
  Req
} from "routing-controllers";
import { MoreThan } from "typeorm";

import { getRepository } from "@core/database";

import Contact from "@models/Contact";
import UploadFlow from "@models/UploadFlow";

import { GetUploadFlowDto } from "@api/dto/UploadFlowDto";
import BadRequestError from "@api/errors/BadRequestError";
import { UUIDParams } from "@api/params/UUIDParams";

async function canUploadOrFail(ipAddress: string, date: Date, max: number) {
  const uploadFlows = await getRepository(UploadFlow).find({
    where: { ipAddress, date: MoreThan(date) }
  });
  if (uploadFlows.length >= max) {
    throw new HttpError(429, "Too many upload requests");
  }
}

@JsonController("/upload")
export class UploadController {
  @Post("/")
  async create(
    @CurrentUser() contact: Contact | undefined,
    @Req() req: Request
  ): Promise<GetUploadFlowDto> {
    if (!req.ip) {
      throw new BadRequestError();
    }

    // No more than 10 uploads in a minute for all users
    const oneMinAgo = sub(new Date(), { minutes: 1 });
    await canUploadOrFail(req.ip, oneMinAgo, 10);

    // No more than 20 uploads in an hour for non-authed users
    if (!contact) {
      const oneHourAgo = sub(new Date(), { hours: 1 });
      await canUploadOrFail(req.ip, oneHourAgo, 20);
    }

    const newUploadFlow = await getRepository(UploadFlow).save({
      contact: contact || null,
      ipAddress: req.ip,
      used: false
    });

    return plainToInstance(GetUploadFlowDto, { id: newUploadFlow.id });
  }

  // This should be a POST request as it's not idempotent, but we use nginx's
  // auth_request directive to call this endpoint and it only does GET requests
  @Get("/:id")
  @OnUndefined(204)
  async get(@Params() { id }: UUIDParams): Promise<void> {
    // Flows are valid for a minute
    const oneMinAgo = sub(new Date(), { minutes: 1 });
    const res = await getRepository(UploadFlow).update(
      { id, date: MoreThan(oneMinAgo), used: false },
      { used: true }
    );

    if (!res.affected) {
      throw new NotFoundError();
    }
  }
}

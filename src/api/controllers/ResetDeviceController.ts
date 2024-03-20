import { Request } from "express";
import {
  Body,
  JsonController,
  OnUndefined,
  Params,
  Post,
  Put,
  Req
} from "routing-controllers";

import ContactsService from "#core/services/ContactsService";

import { login } from "#api/utils";
import {
  CreateResetDeviceDto,
  UpdateResetDeviceDto
} from "#api/dto/ResetDeviceDto";
import { UUIDParams } from "#api/params/UUIDParams";

@JsonController("/reset-device")
export class ResetDeviceController {
  @OnUndefined(204)
  @Post()
  async create(@Body() data: CreateResetDeviceDto): Promise<void> {
    await ContactsService.resetDeviceBegin(
      data.email,
      data.type,
      data.resetUrl
    );
  }

  @OnUndefined(204)
  @Put("/:id")
  async complete(
    @Req() req: Request,
    @Params() { id }: UUIDParams,
    @Body() data: UpdateResetDeviceDto
  ): Promise<void> {
    const contact = await ContactsService.resetDeviceComplete(
      id,
      data.password
    );
    await login(req, contact);
  }
}

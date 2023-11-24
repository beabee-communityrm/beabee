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

import ContactsService from "@core/services/ContactsService";

import { login } from "@api/utils";
import { UUIDParam } from "@api/data";
import {
  CreateResetDeviceData,
  UpdateResetDeviceData
} from "@api/data/ResetDeviceData";

@JsonController("/reset-device")
export class ResetDeviceController {
  @OnUndefined(204)
  @Post()
  async create(@Body() data: CreateResetDeviceData): Promise<void> {
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
    @Params() { id }: UUIDParam,
    @Body() data: UpdateResetDeviceData
  ): Promise<void> {
    const contact = await ContactsService.resetDeviceComplete(
      id,
      data.password
    );
    await login(req, contact);
  }
}

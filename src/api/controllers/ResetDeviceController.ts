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

import ResetSecurityFlowService from "@core/services/ResetSecurityFlowService";

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
    await ResetSecurityFlowService.resetDeviceBegin(data);
  }

  @OnUndefined(204)
  @Put("/:id")
  async complete(
    @Req() req: Request,
    @Params() { id }: UUIDParam,
    @Body() data: UpdateResetDeviceData
  ): Promise<void> {
    const contact = await ResetSecurityFlowService.resetDeviceComplete(
      id,
      data
    );
    await login(req, contact);
  }
}

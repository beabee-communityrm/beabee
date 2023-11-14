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
  CreateResetPasswordData,
  UpdateResetPasswordData
} from "@api/data/ResetPasswordData";

@JsonController("/reset-password")
export class ResetPasswordController {
  @OnUndefined(204)
  @Post()
  async create(@Body() data: CreateResetPasswordData): Promise<void> {
    await ResetSecurityFlowService.resetPasswordBegin(data);
  }

  @OnUndefined(204)
  @Put("/:id")
  async complete(
    @Req() req: Request,
    @Params() { id }: UUIDParam,
    @Body() data: UpdateResetPasswordData
  ): Promise<void> {
    const contact = await ResetSecurityFlowService.resetPasswordComplete(
      id,
      data
    );
    await login(req, contact);
  }
}

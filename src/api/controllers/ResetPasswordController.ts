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
  CreateResetPasswordDto,
  UpdateResetPasswordDto
} from "@api/dto/ResetPasswordDto";

@JsonController("/reset-password")
export class ResetPasswordController {
  @OnUndefined(204)
  @Post()
  async create(@Body() data: CreateResetPasswordDto): Promise<void> {
    await ContactsService.resetPasswordBegin(data.email, data.resetUrl);
  }

  @OnUndefined(204)
  @Put("/:id")
  async complete(
    @Req() req: Request,
    @Params() { id }: UUIDParam,
    @Body() data: UpdateResetPasswordDto
  ): Promise<void> {
    const contact = await ContactsService.resetPasswordComplete(id, data);
    await login(req, contact);
  }
}

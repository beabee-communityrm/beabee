import { Request } from "express";
import {
  Body,
  JsonController,
  NotFoundError,
  OnUndefined,
  Params,
  Post,
  Put,
  Req
} from "routing-controllers";
import { getRepository } from "typeorm";

import { generatePassword } from "@core/utils/auth";

import ContactsService from "@core/services/ContactsService";
import EmailService from "@core/services/EmailService";

import ResetPasswordFlow from "@models/ResetPasswordFlow";

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
    const contact = await ContactsService.findOne({ email: data.email });
    if (contact) {
      const rpFlow = await getRepository(ResetPasswordFlow).save({ contact });
      await EmailService.sendTemplateToContact("reset-password", contact, {
        rpLink: data.resetUrl + "/" + rpFlow.id
      });
    }
  }

  @OnUndefined(204)
  @Put("/:id")
  async complete(
    @Req() req: Request,
    @Params() { id }: UUIDParam,
    @Body() data: UpdateResetPasswordData
  ): Promise<void> {
    const rpFlow = await getRepository(ResetPasswordFlow).findOne({
      where: { id },
      relations: ["contact"]
    });
    if (rpFlow) {
      await ContactsService.updateContact(rpFlow.contact, {
        password: await generatePassword(data.password)
      });
      await getRepository(ResetPasswordFlow).delete(id);

      await login(req, rpFlow.contact);
    } else {
      throw new NotFoundError();
    }
  }
}

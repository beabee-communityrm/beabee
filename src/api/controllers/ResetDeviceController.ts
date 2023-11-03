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

import ContactsService from "@core/services/ContactsService";
import EmailService from "@core/services/EmailService";
import AuthService from "@core/services/AuthService";
import ContactMfaService from "@core/services/ContactMfaService";

import ResetPasswordFlow from "@models/ResetPasswordFlow";

import { login } from "@api/utils";
import { UUIDParam } from "@api/data";
import {
  CreateResetDeviceData,
  UpdateResetDeviceData
} from "@api/data/ResetDeviceData";
import UnauthorizedError from "@api/errors/UnauthorizedError";

@JsonController("/reset-device")
export class ResetDeviceController {
  @OnUndefined(204)
  @Post()
  async create(@Body() data: CreateResetDeviceData): Promise<void> {
    const contact = await ContactsService.findOne({ email: data.email });
    if (contact) {
      const rpFlow = await getRepository(ResetPasswordFlow).save({ contact });
      await EmailService.sendTemplateToContact("reset-device", contact, {
        rpLink: data.resetUrl + "/" + rpFlow.id
      });
    }
  }

  @OnUndefined(204)
  @Put("/:id")
  async complete(
    @Req() req: Request,
    @Params() { id }: UUIDParam,
    @Body() data: UpdateResetDeviceData
  ): Promise<void> {
    const rpFlow = await getRepository(ResetPasswordFlow).findOne({
      where: { id },
      relations: ["contact"]
    });
    if (rpFlow) {
      // Validate password
      const isValid = await AuthService.isValidPassword(
        rpFlow.contact.password,
        data.password
      );

      if (!isValid) {
        // TODO: Increment tries
        // TODO: Error code
        throw new UnauthorizedError();
      }

      // Disable MFA
      await ContactMfaService.delete(rpFlow.contact);

      // Stop reset flow
      // TODO: Separate reset flow from MFA?
      await getRepository(ResetPasswordFlow).delete(id);

      await login(req, rpFlow.contact);
    } else {
      throw new NotFoundError();
    }
  }
}

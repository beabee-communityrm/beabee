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

import ResetSecurityFlow from "@models/ResetSecurityFlow";

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
    // TODO: Create ResetSecurityFlowService
    const contact = await ContactsService.findOne({ email: data.email });
    if (!contact) {
      return;
    }

    // TODO: Check if contact has MFA enabled

    // TODO: Check if reset password flow already exists, if so throw error

    const rpFlow = await getRepository(ResetSecurityFlow).save({ contact });
    await EmailService.sendTemplateToContact("reset-device", contact, {
      rpLink: data.resetUrl + "/" + rpFlow.id
    });
  }

  @OnUndefined(204)
  @Put("/:id")
  async complete(
    @Req() req: Request,
    @Params() { id }: UUIDParam,
    @Body() data: UpdateResetDeviceData
  ): Promise<void> {
    // TODO: Create ResetSecurityFlowService
    const rpFlow = await getRepository(ResetSecurityFlow).findOne({
      where: { id },
      relations: ["contact"]
    });
    if (!rpFlow) {
      throw new NotFoundError();
    }

    // Validate password
    const isValid = await AuthService.isValidPassword(
      rpFlow.contact.password,
      data.password
    );

    if (!isValid) {
      // TODO: Increment tries
      // TODO: Error codes
      throw new UnauthorizedError();
    }

    // Disable MFA
    await ContactMfaService.deleteUnsecure(rpFlow.contact);

    // Stop reset flow
    await getRepository(ResetSecurityFlow).delete(id);

    await login(req, rpFlow.contact);
  }
}

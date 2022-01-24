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

import MembersService from "@core/services/MembersService";
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
    const member = await MembersService.findOne({ email: data.email });
    if (member) {
      const rpFlow = await getRepository(ResetPasswordFlow).save({ member });
      await EmailService.sendTemplateToMember("reset-password", member, {
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
      relations: ["member"]
    });
    if (rpFlow) {
      await MembersService.updateMember(rpFlow.member, {
        password: await generatePassword(data.password)
      });
      await getRepository(ResetPasswordFlow).delete(id);

      await login(req, rpFlow.member);
    } else {
      throw new NotFoundError();
    }
  }
}

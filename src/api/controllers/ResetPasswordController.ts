import { IsEmail, Validate } from "class-validator";
import { Request } from "express";
import {
  Body,
  JsonController,
  NotFoundError,
  OnUndefined,
  Param,
  Post,
  Put,
  Req
} from "routing-controllers";
import { getRepository } from "typeorm";

import { generatePassword } from "@core/utils/auth";

import MembersService from "@core/services/MembersService";
import EmailService from "@core/services/EmailService";

import ResetPasswordFlow from "@models/ResetPasswordFlow";

import IsPassword from "@api/validators/IsPassword";
import IsUrl from "@api/validators/IsUrl";

import { login } from "@api/utils";

class CreateResetPasswordData {
  @IsEmail()
  email!: string;

  @IsUrl()
  resetUrl!: string;
}

class UpdateResetPasswordData {
  @Validate(IsPassword)
  password!: string;
}

@JsonController("/reset-password")
export class ResetPasswordController {
  @OnUndefined(204)
  @Post()
  async create(
    @Body({ required: true }) data: CreateResetPasswordData
  ): Promise<void> {
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
    @Param("id") id: string,
    @Body({ required: true }) data: UpdateResetPasswordData
  ) {
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

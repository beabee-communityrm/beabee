import { IsEmail, IsUrl, Validate } from "class-validator";
import {
  Body,
  JsonController,
  NotFoundError,
  OnUndefined,
  Param,
  Post,
  Put
} from "routing-controllers";
import { getRepository } from "typeorm";

import { generatePassword } from "@core/utils/auth";

import MembersService from "@core/services/MembersService";
import EmailService from "@core/services/EmailService";

import ResetPasswordFlow from "@models/ResetPasswordFlow";

import IsPassword from "@api/validators/IsPassword";

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
  async blah(
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
    } else {
      throw new NotFoundError();
    }
  }
}

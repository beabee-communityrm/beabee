import { isUUID } from "class-validator";
import {
  Authorized,
  Body,
  Get,
  JsonController,
  Param,
  Patch
} from "routing-controllers";
import { getRepository } from "typeorm";

import EmailService from "@core/services/EmailService";

import Email from "@models/Email";

import { GetEmailData, UpdateEmailData } from "@api/data/EmailData";
import ExternalEmailTemplate from "@api/errors/ExternalEmailTemplate";

async function findEmail(id: string): Promise<Email | undefined> {
  if (isUUID(id, "4")) {
    return await getRepository(Email).findOne(id);
  } else if (EmailService.isTemplate(id)) {
    const maybeEmail = await EmailService.getTemplateEmail(id);
    if (maybeEmail === false) {
      throw new ExternalEmailTemplate();
    } else {
      return maybeEmail || undefined;
    }
  }
}

@Authorized("admin")
@JsonController("/email")
export class EmailController {
  @Get("/:id")
  async getEmail(@Param("id") id: string): Promise<GetEmailData | undefined> {
    const email = await findEmail(id);

    return (
      email && {
        subject: email.subject,
        body: email.body
      }
    );
  }

  @Patch()
  async updateEmail(
    @Param("id") id: string,
    @Body() data: UpdateEmailData
  ): Promise<GetEmailData | undefined> {
    const email = await findEmail(id);
    if (email) {
      await getRepository(Email).update(email.id, data);
      return data;
    }
  }
}

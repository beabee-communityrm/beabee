import { plainToInstance } from "class-transformer";
import { isUUID } from "class-validator";
import {
  Authorized,
  Body,
  Get,
  JsonController,
  Param,
  Put
} from "routing-controllers";
import { ResponseSchema } from "routing-controllers-openapi";

import EmailService from "@core/services/EmailService";

import { getRepository } from "@core/database";

import Email from "@models/Email";

import { EmailDto } from "@api/dto/EmailDto";
import ExternalEmailTemplate from "@api/errors/ExternalEmailTemplate";

async function findEmail(id: string): Promise<Email | null> {
  if (isUUID(id, "4")) {
    return await getRepository(Email).findOneBy({ id });
  } else if (EmailService.isTemplateId(id)) {
    const maybeEmail = await EmailService.getTemplateEmail(id);
    if (maybeEmail) {
      return maybeEmail;
    } else if (maybeEmail === false) {
      throw new ExternalEmailTemplate();
    }
  }
  return null;
}

// TODO: move to transformer
function emailToData(email: Email): EmailDto {
  return plainToInstance(EmailDto, {
    subject: email.subject,
    body: email.body
  });
}

@Authorized("admin")
@JsonController("/email")
export class EmailController {
  @Get("/:id")
  @ResponseSchema(EmailDto, { statusCode: 200 })
  async getEmail(@Param("id") id: string): Promise<EmailDto | undefined> {
    const email = await findEmail(id);
    return email ? emailToData(email) : undefined;
  }

  @Put("/:id")
  @ResponseSchema(EmailDto, { statusCode: 200 })
  async updateEmail(
    @Param("id") id: string,
    @Body() data: EmailDto
  ): Promise<EmailDto | undefined> {
    const email = await findEmail(id);
    if (email) {
      await getRepository(Email).update(email.id, data);
      return data;
    } else if (EmailService.isTemplateId(id)) {
      const email = await getRepository(Email).save({
        name: "Email for " + id,
        ...data
      });
      await EmailService.setTemplateEmail(id, email);
      return emailToData(email);
    }
  }
}

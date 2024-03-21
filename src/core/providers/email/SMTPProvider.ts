import nodemailer from "nodemailer";
import Mail from "nodemailer/lib/mailer";

import { log as mainLogger } from "#core/logging";

import OptionsService from "#core/services/OptionsService";

import { EmailOptions, EmailRecipient, PreparedEmail } from ".";
import BaseProvider from "./BaseProvider";

import { SMTPEmailConfig } from "#config";

const log = mainLogger.child({ app: "smtp-email-provider" });

export default class SMTPProvider extends BaseProvider {
  private readonly client: Mail;

  constructor(settings: SMTPEmailConfig["settings"]) {
    super();
    this.client = nodemailer.createTransport(settings);
  }

  protected async doSendEmail(
    email: PreparedEmail,
    recipients: EmailRecipient[],
    opts?: EmailOptions
  ): Promise<void> {
    if (opts?.sendAt) {
      log.error("SMTPEmailProvider doesn't support sendAt, ignoring email");
      return;
    }

    log.info("Sending email " + email.id);

    for (const recipient of recipients) {
      const mergedBody = Object.keys(recipient.mergeFields || {}).reduce(
        (body, field) => {
          return body.replace(
            new RegExp(`\\*\\|${field}\\|\\*`, "g"),
            "" + recipient.mergeFields![field]
          );
        },
        email.body
      );

      await this.client.sendMail({
        from: {
          name: email.fromName,
          address: email.fromEmail
        },
        to: recipient.to.name
          ? { name: recipient.to.name, address: recipient.to.email }
          : recipient.to.email,
        subject: email.subject,
        html: mergedBody,
        ...(opts?.attachments && {
          attachments: opts.attachments.map((a) => ({
            filename: a.name,
            contentType: a.type,
            content: a.content
          }))
        })
      });
    }
  }
}

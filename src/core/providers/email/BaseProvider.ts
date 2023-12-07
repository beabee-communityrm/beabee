import { createQueryBuilder, getRepository } from "@core/database";
import { log as mainLogger } from "@core/logging";
import { formatEmailBody } from "@core/utils/email";

import OptionsService from "@core/services/OptionsService";
import ResetSecurityFlowService from "@core/services/ResetSecurityFlowService";

import Email from "@models/Email";
import Contact from "@models/Contact";

import { RESET_SECURITY_FLOW_TYPE } from "@enums/reset-security-flow-type";

import {
  EmailProvider,
  EmailRecipient,
  EmailOptions,
  EmailTemplate,
  PreparedEmail
} from ".";

import config from "@config";

const log = mainLogger.child({ app: "base-email-provider" });

function generateResetPasswordLinks(type: "set" | "reset") {
  const mergeField = type === "set" ? "SPLINK" : "RPLINK";
  const baseUrl = `${config.audience}/auth/${type}-password`;
  const fallbackUrl = `${config.audience}/auth/login`;

  return async (recipients: EmailRecipient[]): Promise<EmailRecipient[]> => {
    // Filter for those with no merge field value
    const emails = recipients
      .filter((r) => !r.mergeFields?.[mergeField])
      .map((r) => r.to.email);

    // Nothing to do
    if (emails.length === 0) {
      return recipients;
    }

    log.info(`Creating ${emails.length} links for ${mergeField}`);

    // Get list of contacts who match the recipients
    const contacts = await createQueryBuilder(Contact, "c")
      .select(["id", "email"])
      .where("c.email IN (:...emails)", { emails })
      .getRawMany<{ id: string; email: string }>();

    const contactIdsByEmail = Object.fromEntries(
      contacts.map((m) => [m.email, m.id])
    );

    const rpFlowIdsByContactId = await ResetSecurityFlowService.createManyRaw(
      Object.values(contactIdsByEmail),
      RESET_SECURITY_FLOW_TYPE.PASSWORD
    );

    return recipients.map((recipient) => {
      // Don't touch recipients with the merge field already set
      if (recipient.mergeFields?.[mergeField]) {
        return recipient;
      } else {
        const rpFlowId =
          rpFlowIdsByContactId[contactIdsByEmail[recipient.to.email]];
        return {
          ...recipient,
          mergeFields: {
            ...recipient.mergeFields,
            [mergeField]: rpFlowId ? `${baseUrl}/${rpFlowId}` : fallbackUrl
          }
        };
      }
    });
  };
}

const magicMergeFields = ["SPLINK", "LOGINLINK", "RPLINK"] as const;

const magicMergeFieldsProcessors = {
  SPLINK: generateResetPasswordLinks("set"),
  RPLINK: generateResetPasswordLinks("reset"),
  LOGINLINK: async (recipients: EmailRecipient[]) => {
    // TODO: generate login override link
    return recipients.map((recipient) =>
      recipient.mergeFields?.LOGINLINK
        ? recipient
        : {
            ...recipient,
            mergeFields: {
              ...recipient.mergeFields,
              LOGINLINK: `${config.audience}/auth/login`
            }
          }
    );
  }
} as const;

export default abstract class BaseProvider implements EmailProvider {
  protected abstract doSendEmail(
    email: PreparedEmail,
    recipients: EmailRecipient[],
    opts?: EmailOptions | undefined
  ): Promise<void>;

  async sendEmail(
    email: Email,
    recipients: EmailRecipient[],
    opts?: EmailOptions | undefined
  ): Promise<void> {
    const preparedEmail = {
      ...email,
      body: formatEmailBody(email.body),
      fromEmail: email.fromEmail || OptionsService.getText("support-email"),
      fromName:
        email.fromName ||
        (email.fromEmail ? "" : OptionsService.getText("support-email-from"))
    };

    let preparedRecipients = recipients;
    for (const mergeField of magicMergeFields) {
      if (email.body.includes(`*|${mergeField}|*`)) {
        preparedRecipients =
          await magicMergeFieldsProcessors[mergeField](preparedRecipients);
      }
    }

    await this.doSendEmail(preparedEmail, preparedRecipients, opts);
  }

  async sendTemplate(
    template: string,
    recipients: EmailRecipient[],
    opts?: EmailOptions
  ): Promise<void> {
    const email = await getRepository(Email).findOneBy({ id: template });
    if (email) {
      await this.sendEmail(email, recipients, opts);
    }
  }

  async getTemplateEmail(template: string): Promise<false | Email | null> {
    return (await getRepository(Email).findOneBy({ id: template })) || null;
  }

  async getTemplates(): Promise<EmailTemplate[]> {
    const emails = await getRepository(Email).find();
    return emails.map((email) => ({ id: email.id, name: email.name }));
  }
}

import mandrill from "mandrill-api/mandrill";
import { getRepository } from "typeorm";

import { log as mainLogger } from "@core/logging";

import Email from "@models/Email";

import {
  EmailOptions,
  EmailPerson,
  EmailProvider,
  EmailRecipient,
  EmailTemplate
} from ".";
import { MandrillEmailConfig } from "@config";

const log = mainLogger.child({ app: "mandrill-email-provider" });

interface MandrillTemplate {
  slug: string;
  name: string;
}

interface MandrillMessage {
  to: { email: string; name: string }[];
  merge_vars: {
    rcpt: string;
    vars?: { name: string; content: unknown }[];
  }[];
  attachments?: { type: string; name: string; content: string }[];
}

export default class MandrillProvider implements EmailProvider {
  private readonly client: any;

  constructor(settings: MandrillEmailConfig["settings"]) {
    this.client = new mandrill.Mandrill(settings.apiKey);
  }

  async sendEmail(
    from: EmailPerson,
    recipients: EmailRecipient[],
    subject: string,
    body: string,
    opts?: EmailOptions
  ): Promise<void> {
    const resp = await new Promise((resolve, reject) => {
      this.client.messages.send(
        {
          message: {
            ...this.createMessageData(recipients, opts),
            from_name: from.name,
            from_email: from.email,
            subject,
            html: body,
            auto_text: true
          },
          ...(opts?.sendAt && { send_at: opts.sendAt })
        },
        resolve,
        reject
      );
    });

    log.info("Sent email", resp);
  }

  async sendTemplate(
    template: string,
    recipients: EmailRecipient[],
    opts?: EmailOptions
  ): Promise<void> {
    const [templateType, templateId] = template.split("_", 2);

    log.info(`Sending template ${template}`);

    if (templateType === "mandrill") {
      const resp = await new Promise((resolve, reject) => {
        this.client.messages.sendTemplate(
          {
            message: this.createMessageData(recipients, opts),
            template_name: templateId,
            template_content: [],
            ...(opts?.sendAt && { send_at: opts.sendAt })
          },
          resolve,
          reject
        );
      });
      log.info(`Sent template ${template}`, resp);
    } else if (templateType === "local") {
      const email = await getRepository(Email).findOne(templateId);
      if (email) {
        this.sendEmail(
          { email: email.fromEmail, name: email.fromName },
          recipients,
          email.subject,
          email.body.replace(/\r\n/g, "<br/>"),
          opts
        );
      }
    }
  }

  async getTemplates(): Promise<EmailTemplate[]> {
    const templates: MandrillTemplate[] = await new Promise(
      (resolve, reject) => {
        this.client.templates.list(resolve, reject);
      }
    );

    const emails = await getRepository(Email).find();

    return [
      ...emails.map((email) =>
        this.createEmailTemplate("local", email.id, email.name)
      ),
      ...templates.map((template) =>
        this.createEmailTemplate("mandrill", template.slug, template.name)
      )
    ];
  }

  async getTemplate(template: string): Promise<EmailTemplate | undefined> {
    const [templateType, templateId] = template.split("_", 2);
    if (templateType === "mandrill") {
      const template: MandrillTemplate = await new Promise(
        (resolve, reject) => {
          this.client.templates.info({ name: templateId }, resolve, reject);
        }
      );
      return this.createEmailTemplate("mandrill", template.slug, template.name);
    } else if (templateType === "local") {
      const email = await getRepository(Email).findOne(templateId);
      return email && this.createEmailTemplate("local", email.id, email.name);
    }
  }

  private createEmailTemplate(
    prefix: "mandrill" | "local",
    id: string,
    name: string
  ) {
    return {
      id: prefix + "_" + id,
      name: (prefix === "mandrill" ? "Mandrill: " : "Local: ") + name
    };
  }

  private createMessageData(
    recipients: EmailRecipient[],
    opts?: EmailOptions
  ): MandrillMessage {
    return {
      to: recipients.map((r) => r.to),
      merge_vars: recipients.map((r) => ({
        rcpt: r.to.email,
        vars:
          r.mergeFields &&
          Object.keys(r.mergeFields).map((mergeField) => ({
            name: mergeField,
            content: r.mergeFields![mergeField]
          }))
      })),
      ...(opts?.attachments && { attachments: opts.attachments })
    };
  }
}

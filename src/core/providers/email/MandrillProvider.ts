import mandrill from "mandrill-api/mandrill";

import { log as mainLogger } from "@core/logging";

import Email from "@models/Email";

import { EmailOptions, EmailRecipient, EmailTemplate, PreparedEmail } from ".";
import BaseProvider from "./BaseProvider";

import { MandrillEmailConfig } from "@config";

const log = mainLogger.child({ app: "mandrill-email-provider" });

interface MandrillTemplate {
  slug: string;
  name: string;
}

interface MandrillMessage {
  to: { email: string; name?: string }[];
  merge_vars: {
    rcpt: string;
    vars?: { name: string; content: unknown }[];
  }[];
  attachments?: { type: string; name: string; content: string }[];
}

export default class MandrillProvider extends BaseProvider {
  private readonly client: any;

  constructor(settings: MandrillEmailConfig["settings"]) {
    super();
    this.client = new mandrill.Mandrill(settings.apiKey);
  }

  protected async doSendEmail(
    email: PreparedEmail,
    recipients: EmailRecipient[],
    opts?: EmailOptions
  ): Promise<void> {
    const resp = await new Promise((resolve, reject) => {
      this.client.messages.send(
        {
          message: {
            ...this.createMessageData(recipients, opts),
            from_name: email.fromName,
            from_email: email.fromEmail,
            subject: email.subject,
            html: email.body,
            auto_text: true
          },
          ...(opts?.sendAt && { send_at: opts.sendAt.toISOString() })
        },
        resolve,
        reject
      );
    });

    log.info("Sent email", { resp });
  }

  async sendTemplate(
    template: string,
    recipients: EmailRecipient[],
    opts?: EmailOptions
  ): Promise<void> {
    log.info(`Sending template ${template}`);

    if (template.startsWith("mandrill_")) {
      const resp = await new Promise((resolve, reject) => {
        this.client.messages.sendTemplate(
          {
            message: this.createMessageData(recipients, opts),
            template_name: template.substring(9), // Remove mandrill_
            template_content: [],
            ...(opts?.sendAt && { send_at: opts.sendAt })
          },
          resolve,
          reject
        );
      });
      log.info(`Sent template ${template}`, { resp });
    } else {
      super.sendTemplate(template, recipients, opts);
    }
  }

  async getTemplateEmail(template: string): Promise<false | Email | null> {
    return template.startsWith("mandrill_")
      ? false
      : await super.getTemplateEmail(template);
  }

  async getTemplates(): Promise<EmailTemplate[]> {
    const templates: MandrillTemplate[] = await new Promise(
      (resolve, reject) => {
        this.client.templates.list(resolve, reject);
      }
    );

    const localEmailTemplates = await super.getTemplates();

    return [
      ...localEmailTemplates.map((email) => ({
        id: email.id,
        name: "Local: " + email.name
      })),
      ...templates.map((template) => ({
        id: "mandrill_" + template.slug,
        name: "Mandrill: " + template.name
      }))
    ];
  }

  private createMessageData(
    recipients: EmailRecipient[],
    opts?: EmailOptions
  ): MandrillMessage {
    return {
      to: recipients.map((r) => r.to),
      merge_vars: recipients.map((r) => ({
        rcpt: r.to.email,
        ...(r.mergeFields && {
          vars: Object.entries(r.mergeFields).map(([name, content]) => ({
            name,
            content
          }))
        })
      })),
      ...(opts?.attachments && { attachments: opts.attachments })
    };
  }
}

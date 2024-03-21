import axios, { AxiosRequestTransformer } from "axios";

import { log as mainLogger } from "#core/logging";

import Email from "#models/Email";

import { EmailOptions, EmailRecipient, EmailTemplate, PreparedEmail } from ".";
import BaseProvider from "./BaseProvider";

import { MandrillEmailConfig } from "#config";

const log = mainLogger.child({ app: "mandrill-email-provider" });

interface MandrillTemplate {
  slug: string;
  name: string;
}

interface MandrillMessage {
  to: { email: string; name?: string }[];
  merge_vars: {
    rcpt: string;
    vars: { name: string; content: string }[];
  }[];
  attachments?: { type: string; name: string; content: string }[];
}

export default class MandrillProvider extends BaseProvider {
  private readonly instance;

  constructor(settings: MandrillEmailConfig["settings"]) {
    super();
    this.instance = axios.create({
      baseURL: "https://mandrillapp.com/api/1.0/",
      // Add key to all POST request bodys
      transformRequest: [
        (data, headers) => {
          return { ...data, key: settings.apiKey };
        },
        ...(axios.defaults.transformRequest as AxiosRequestTransformer[])
      ],
      timeout: 1000,
      headers: { "X-Custom-Header": "foobar" }
    });
  }

  protected async doSendEmail(
    email: PreparedEmail,
    recipients: EmailRecipient[],
    opts?: EmailOptions
  ): Promise<void> {
    const resp = await this.instance.post("/messages/send", {
      message: {
        ...this.createMessageData(recipients, opts),
        from_name: email.fromName,
        from_email: email.fromEmail,
        subject: email.subject,
        html: email.body,
        auto_text: true
      },
      ...(opts?.sendAt && { send_at: opts.sendAt.toISOString() })
    });

    log.info("Sent email", { data: resp.data });
  }

  async sendTemplate(
    templateId: string,
    recipients: EmailRecipient[],
    opts?: EmailOptions
  ): Promise<void> {
    log.info(`Sending template ${templateId}`);

    if (templateId.startsWith("mandrill_")) {
      const resp = await this.instance.post("/messages/send-template", {
        message: this.createMessageData(recipients, opts),
        template_name: templateId.substring(9), // Remove mandrill_
        template_content: [],
        ...(opts?.sendAt && { send_at: opts.sendAt.toISOString() })
      });
      log.info(`Sent template ${templateId}`, { data: resp.data });
    } else {
      super.sendTemplate(templateId, recipients, opts);
    }
  }

  async getTemplateEmail(templateId: string): Promise<false | Email | null> {
    return templateId.startsWith("mandrill_")
      ? false
      : await super.getTemplateEmail(templateId);
  }

  async getTemplates(): Promise<EmailTemplate[]> {
    const resp =
      await this.instance.post<MandrillTemplate[]>("/templates/list");
    const localEmailTemplates = await super.getTemplates();

    return [
      ...localEmailTemplates.map((email) => ({
        id: email.id,
        name: "Local: " + email.name
      })),
      ...resp.data.map((template) => ({
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
        vars: Object.entries(r.mergeFields || []).map(([name, content]) => ({
          name,
          content
        }))
      })),
      ...(opts?.attachments && { attachments: opts.attachments })
    };
  }
}

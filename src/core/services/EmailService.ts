import fs from "fs";
import moment from "moment";
import path from "path";
import { loadFront } from "yaml-front-matter";

import { log as mainLogger } from "@core/logging";

import OptionsService from "@core/services/OptionsService";

import {
  EmailMergeFields,
  EmailOptions,
  EmailPerson,
  EmailProvider,
  EmailRecipient
} from "@core/providers/email";
import MandrillProvider from "@core/providers/email/MandrillProvider";
import SendGridProvider from "@core/providers/email/SendGridProvider";
import SMTPProvider from "@core/providers/email/SMTPProvider";

import Email from "@models/Email";
import Contact from "@models/Contact";
import Callout from "@models/Callout";

import config from "@config";
import { isLocale, Locale } from "@locale";

const log = mainLogger.child({ app: "email-service" });

const generalEmailTemplates = {
  "purchased-gift": (params: {
    fromName: string;
    gifteeFirstName: string;
    giftStartDate: Date;
  }) => ({
    PURCHASER: params.fromName,
    GIFTEE: params.gifteeFirstName,
    GIFTDATE: moment.utc(params.giftStartDate).format("MMMM Do")
  }),
  "confirm-email": (params: {
    firstName: string;
    lastName: string;
    confirmLink: string;
  }) => ({
    FNAME: params.firstName,
    LNAME: params.lastName,
    CONFIRMLINK: params.confirmLink
  }),
  "expired-special-url-resend": (params: {
    firstName: string;
    newUrl: string;
  }) => ({
    FNAME: params.firstName,
    URL: params.newUrl
  })
} as const;

const adminEmailTemplates = {
  "new-member": (params: { contact: Contact }) => ({
    MEMBERID: params.contact.id,
    MEMBERNAME: params.contact.fullname
  }),
  "cancelled-member": (params: { contact: Contact }) => ({
    MEMBERID: params.contact.id,
    MEMBERNAME: params.contact.fullname
  }),
  "new-callout-response": (params: {
    calloutSlug: string;
    calloutTitle: string;
    responderName: string;
  }) => ({
    CALLOUTSLUG: params.calloutSlug,
    CALLOUTTITLE: params.calloutTitle,
    RESPNAME: params.responderName
  })
} as const;

const contactEmailTemplates = {
  welcome: (contact: Contact) => ({
    REFCODE: contact.referralCode
  }),
  "welcome-post-gift": () => ({}),
  "reset-password": (_: Contact, params: { rpLink: string }) => ({
    RPLINK: params.rpLink
  }),
  "reset-device": (_: Contact, params: { rpLink: string }) => ({
    RPLINK: params.rpLink
  }),
  "cancelled-contribution": (contact: Contact) => ({
    EXPIRES: contact.membership?.dateExpires
      ? moment.utc(contact.membership.dateExpires).format("dddd Do MMMM")
      : "-",
    MEMBERSHIPID: contact.id
  }),
  "cancelled-contribution-no-survey": (contact: Contact) => {
    return {
      EXPIRES: contact.membership?.dateExpires
        ? moment.utc(contact.membership.dateExpires).format("dddd Do MMMM")
        : "-"
    };
  },
  "successful-referral": (
    contact: Contact,
    params: { refereeName: string; isEligible: boolean }
  ) => ({
    REFCODE: contact.referralCode,
    REFEREENAME: params.refereeName,
    ISELIGIBLE: params.isEligible
  }),
  "giftee-success": (
    _: Contact,
    params: { fromName: string; message: string; giftCode: string }
  ) => ({
    PURCHASER: params.fromName,
    MESSAGE: params.message,
    ACTIVATELINK: config.audience + "/gift/" + params.giftCode
  }),
  "manual-to-automatic": () => ({}),
  "email-exists-login": (_: Contact, params: { loginLink: string }) => ({
    LOGINLINK: params.loginLink
  }),
  "email-exists-set-password": (_: Contact, params: { spLink: string }) => ({
    SPLINK: params.spLink
  })
} as const;

type GeneralEmailTemplates = typeof generalEmailTemplates;
type GeneralEmailTemplateId = keyof GeneralEmailTemplates;
type AdminEmailTemplates = typeof adminEmailTemplates;
type AdminEmailTemplateId = keyof AdminEmailTemplates;
type ContactEmailTemplates = typeof contactEmailTemplates;
type ContactEmailTemplateId = keyof ContactEmailTemplates;

type ContactEmailParams<T extends ContactEmailTemplateId> = Parameters<
  ContactEmailTemplates[T]
>[1];

type EmailTemplateId =
  | GeneralEmailTemplateId
  | AdminEmailTemplateId
  | ContactEmailTemplateId;

class EmailService {
  private readonly provider: EmailProvider =
    config.email.provider === "mandrill"
      ? new MandrillProvider(config.email.settings)
      : config.email.provider === "sendgrid"
        ? new SendGridProvider(config.email.settings)
        : new SMTPProvider(config.email.settings);

  private defaultEmails: Partial<
    Record<Locale, Partial<Record<EmailTemplateId, Email>>>
  > = {};

  constructor() {
    const emailDir = path.join(__dirname, "../data/email");
    const emailFiles = fs.readdirSync(emailDir);
    log.info("Loading default emails");

    for (const emailFile of emailFiles) {
      const [id, locale] = path.basename(emailFile, ".yfm").split("_", 2);
      if (!this.isTemplateId(id) || !isLocale(locale)) {
        log.error(`Unknown ID (${id}) or locale (${locale})`);
        continue;
      }

      const { __content: body, ...data } = loadFront(
        fs.readFileSync(path.join(emailDir, emailFile))
      );
      // TODO: currently just spoofing an Email, could revisit
      const email = new Email();
      Object.assign(email, data);
      email.id = emailFile;
      email.body = body;

      if (!this.defaultEmails[locale]) {
        this.defaultEmails[locale] = {};
      }
      this.defaultEmails[locale]![id] = email;
    }
  }

  async sendEmail(
    email: Email,
    recipients: EmailRecipient[],
    opts?: EmailOptions
  ): Promise<void> {
    log.info("Sending email", { email: email.id, recipients });
    try {
      await this.provider.sendEmail(email, recipients, opts);
    } catch (error) {
      log.error("Unable to send email " + email.id, error);
    }
  }

  async sendEmailToContact(
    email: Email,
    contacts: Contact[],
    opts?: EmailOptions
  ): Promise<void> {
    const recipients = contacts.map((contact) =>
      this.convertContactToRecipient(contact)
    );
    await this.sendEmail(email, recipients, opts);
  }

  async sendTemplateTo<T extends GeneralEmailTemplateId>(
    template: T,
    to: EmailPerson,
    params: Parameters<GeneralEmailTemplates[T]>[0],
    opts?: EmailOptions
  ): Promise<void> {
    const mergeFields = generalEmailTemplates[template](params as any); // https://github.com/microsoft/TypeScript/issues/30581
    await this.sendTemplate(template, [{ to, mergeFields }], opts, true);
  }

  async sendTemplateToContact<T extends ContactEmailTemplateId>(
    template: T,
    contact: Contact,
    params: ContactEmailParams<T>,
    opts?: EmailOptions
  ): Promise<void>;
  async sendTemplateToContact<
    T extends ContactEmailParams<T> extends undefined
      ? ContactEmailTemplateId
      : never
  >(
    template: T,
    contact: Contact,
    params?: undefined,
    opts?: EmailOptions
  ): Promise<void>;
  async sendTemplateToContact<T extends ContactEmailTemplateId>(
    template: T,
    contact: Contact,
    params: ContactEmailParams<T>,
    opts?: EmailOptions
  ): Promise<void> {
    log.info("Sending template to contact " + contact.id);

    const recipient = this.convertContactToRecipient(
      contact,
      contactEmailTemplates[template](contact, params as any) // https://github.com/microsoft/TypeScript/issues/30581
    );

    await this.sendTemplate(template, [recipient], opts, true);
  }

  async sendTemplateToAdmin<T extends AdminEmailTemplateId>(
    template: T,
    params: Parameters<AdminEmailTemplates[T]>[0],
    opts?: EmailOptions
  ): Promise<void> {
    const recipient = {
      to: { email: OptionsService.getText("support-email") },
      mergeFields: adminEmailTemplates[template](params as any)
    };

    await this.sendTemplate(template, [recipient], opts, false);
  }

  private async sendTemplate(
    template: EmailTemplateId,
    recipients: EmailRecipient[],
    opts: EmailOptions | undefined,
    required: boolean
  ): Promise<void> {
    const providerTemplate = this.getProviderTemplate(template);
    if (providerTemplate) {
      log.info("Sending template " + template, {
        template,
        providerTemplate,
        recipients
      });
      try {
        await this.provider.sendTemplate(providerTemplate, recipients, opts);
      } catch (error) {
        log.error("Unable to send template " + template, error);
      }
      // Fallback to cancelled contribution email if no no-survey variant
    } else if (template === "cancelled-contribution-no-survey") {
      this.sendTemplate("cancelled-contribution", recipients, opts, required);
    } else {
      const defaultEmail = this.getDefaultEmail(template);
      if (defaultEmail) {
        this.sendEmail(defaultEmail, recipients, opts);
      } else if (required) {
        log.error(
          `Tried to send ${template} that has no provider template or default`
        );
      }
    }
  }

  async getTemplateEmail(
    template: EmailTemplateId
  ): Promise<false | Email | null> {
    const providerTemplate = this.getProviderTemplate(template);
    return providerTemplate
      ? await this.provider.getTemplateEmail(providerTemplate)
      : this.getDefaultEmail(template) || null;
  }

  async setTemplateEmail(
    template: EmailTemplateId,
    email: Email
  ): Promise<void> {
    OptionsService.setJSON("email-templates", {
      ...OptionsService.getJSON("email-templates"),
      [template]: email.id
    });
  }

  isTemplateId(template: string): template is EmailTemplateId {
    return (
      template in generalEmailTemplates ||
      template in adminEmailTemplates ||
      template in contactEmailTemplates
    );
  }

  private getProviderTemplate(template: EmailTemplateId): string | undefined {
    return OptionsService.getJSON("email-templates")[template];
  }

  private getDefaultEmail(template: EmailTemplateId): Email | undefined {
    const locale = OptionsService.getText("locale") as Locale;
    return (
      this.defaultEmails[locale]?.[template] ||
      this.defaultEmails.en?.[template]
    );
  }

  private convertContactToRecipient(
    contact: Contact,
    additionalMergeFields?: EmailMergeFields
  ): EmailRecipient {
    return {
      to: { email: contact.email, name: contact.fullname },
      mergeFields: {
        EMAIL: contact.email,
        NAME: contact.fullname,
        FNAME: contact.firstname,
        LNAME: contact.lastname,
        ...additionalMergeFields
      }
    };
  }
}

export default new EmailService();

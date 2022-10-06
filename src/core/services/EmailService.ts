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
import Member from "@models/Member";
import Poll from "@models/Poll";

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
  "new-member": (params: { member: Member }) => ({
    MEMBERID: params.member.id,
    MEMBERNAME: params.member.fullname
  }),
  "cancelled-member": (params: { member: Member }) => ({
    MEMBERID: params.member.id,
    MEMBERNAME: params.member.fullname
  }),
  "new-callout-response": (params: { poll: Poll; responderName: string }) => ({
    CALLOUTSLUG: params.poll.slug,
    CALLOUTTITLE: params.poll.title,
    RESPNAME: params.responderName
  })
} as const;

const memberEmailTemplates = {
  welcome: (member: Member) => ({
    REFCODE: member.referralCode
  }),
  "welcome-post-gift": () => ({}),
  "reset-password": (member: Member, params: { rpLink: string }) => ({
    RPLINK: params.rpLink
  }),
  "cancelled-contribution": (member: Member) => ({
    EXPIRES: member.membership?.dateExpires
      ? moment.utc(member.membership.dateExpires).format("dddd Do MMMM")
      : "-",
    MEMBERSHIPID: member.id
  }),
  "cancelled-contribution-no-survey": (member: Member) => {
    return {
      EXPIRES: member.membership?.dateExpires
        ? moment.utc(member.membership.dateExpires).format("dddd Do MMMM")
        : "-"
    };
  },
  "successful-referral": (
    member: Member,
    params: { refereeName: string; isEligible: boolean }
  ) => ({
    REFCODE: member.referralCode,
    REFEREENAME: params.refereeName,
    ISELIGIBLE: params.isEligible
  }),
  "giftee-success": (
    member: Member,
    params: { fromName: string; message: string; giftCode: string }
  ) => ({
    PURCHASER: params.fromName,
    MESSAGE: params.message,
    ACTIVATELINK: config.audience + "/gift/" + params.giftCode
  }),
  "manual-to-automatic": () => ({}),
  "email-exists-login": (member: Member, params: { loginLink: string }) => ({
    LOGINLINK: params.loginLink
  }),
  "email-exists-set-password": (
    member: Member,
    params: { spLink: string }
  ) => ({
    SPLINK: params.spLink
  })
} as const;

type GeneralEmailTemplates = typeof generalEmailTemplates;
type GeneralEmailTemplateId = keyof GeneralEmailTemplates;
type AdminEmailTemplates = typeof adminEmailTemplates;
type AdminEmailTemplateId = keyof AdminEmailTemplates;
type MemberEmailTemplates = typeof memberEmailTemplates;
type MemberEmailTemplateId = keyof MemberEmailTemplates;

type MemberEmailParams<T extends MemberEmailTemplateId> = Parameters<
  MemberEmailTemplates[T]
>[1];

type EmailTemplateId =
  | GeneralEmailTemplateId
  | AdminEmailTemplateId
  | MemberEmailTemplateId;

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
    await this.provider.sendEmail(email, recipients, opts);
  }

  async sendEmailToMembers(
    email: Email,
    members: Member[],
    opts?: EmailOptions
  ): Promise<void> {
    const recipients = members.map((member) =>
      this.convertMemberToRecipient(member)
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

  async sendTemplateToMember<T extends MemberEmailTemplateId>(
    template: T,
    member: Member,
    params: MemberEmailParams<T>,
    opts?: EmailOptions
  ): Promise<void>;
  async sendTemplateToMember<
    T extends MemberEmailParams<T> extends undefined
      ? MemberEmailTemplateId
      : never
  >(
    template: T,
    member: Member,
    params?: undefined,
    opts?: EmailOptions
  ): Promise<void>;
  async sendTemplateToMember<T extends MemberEmailTemplateId>(
    template: T,
    member: Member,
    params: MemberEmailParams<T>,
    opts?: EmailOptions
  ): Promise<void> {
    log.info("Sending template to member " + member.id);

    const recipient = this.convertMemberToRecipient(
      member,
      memberEmailTemplates[template](member, params as any) // https://github.com/microsoft/TypeScript/issues/30581
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
      await this.provider.sendTemplate(providerTemplate, recipients, opts);
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
      template in memberEmailTemplates
    );
  }

  private getProviderTemplate(template: EmailTemplateId): string | undefined {
    return OptionsService.getJSON("email-templates")[template];
  }

  private getDefaultEmail(template: EmailTemplateId): Email | undefined {
    return this.defaultEmails[OptionsService.getText("locale") as Locale]?.[
      template
    ];
  }

  private convertMemberToRecipient(
    member: Member,
    additionalMergeFields?: EmailMergeFields
  ): EmailRecipient {
    return {
      to: { email: member.email, name: member.fullname },
      mergeFields: {
        EMAIL: member.email,
        NAME: member.fullname,
        FNAME: member.firstname,
        LNAME: member.lastname,
        ...additionalMergeFields
      }
    };
  }
}

export default new EmailService();

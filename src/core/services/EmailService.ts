import moment from "moment";

import { log as mainLogger } from "@core/logging";

import OptionsService from "@core/services/OptionsService";

import {
  EmailMergeFields,
  EmailOptions,
  EmailPerson,
  EmailProvider,
  EmailRecipient,
  EmailTemplate
} from "@core/providers/email";
import MandrillProvider from "@core/providers/email/MandrillProvider";
import SendGridProvider from "@core/providers/email/SendGridProvider";
import SMTPProvider from "@core/providers/email/SMTPProvider";

import Email from "@models/Email";
import Member from "@models/Member";

import config from "@config";

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
  "confirm-email": (params: { firstName: string; confirmLink: string }) => ({
    FNAME: params.firstName,
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

class EmailService implements EmailProvider {
  private readonly provider: EmailProvider =
    config.email.provider === "mandrill"
      ? new MandrillProvider(config.email.settings)
      : config.email.provider === "sendgrid"
      ? new SendGridProvider(config.email.settings)
      : new SMTPProvider(config.email.settings);

  async sendEmail(
    email: Email,
    recipients: EmailRecipient[],
    opts?: EmailOptions
  ): Promise<void> {
    log.info("Sending email", { email: email.id, recipients });
    await this.provider.sendEmail(email, recipients, opts);
  }

  async sendTemplate(
    template: EmailTemplateId,
    recipients: EmailRecipient[],
    opts?: EmailOptions
  ): Promise<void> {
    const providerTemplate = this.providerTemplateMap[template];
    if (providerTemplate) {
      log.info("Sending template " + template, {
        template,
        providerTemplate,
        recipients
      });
      await this.provider.sendTemplate(providerTemplate, recipients, opts);
    } else {
      log.error(`Tried to send ${template} that has no provider template set`);
    }
  }

  async sendTemplateTo<T extends GeneralEmailTemplateId>(
    template: T,
    to: EmailPerson,
    params: Parameters<GeneralEmailTemplates[T]>[0],
    opts?: EmailOptions
  ): Promise<void> {
    const mergeFields = generalEmailTemplates[template](params as any); // https://github.com/microsoft/TypeScript/issues/30581
    await this.sendTemplate(template, [{ to, mergeFields }], opts);
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

    const recipient = this.memberToRecipient(
      member,
      memberEmailTemplates[template](member, params as any) // https://github.com/microsoft/TypeScript/issues/30581
    );

    await this.sendTemplate(template, [recipient], opts);
  }

  async sendTemplateToAdmin<T extends AdminEmailTemplateId>(
    template: T,
    params: Parameters<AdminEmailTemplates[T]>[0],
    opts?: EmailOptions
  ): Promise<void> {
    // Admin emails don't need to be set
    if (this.providerTemplateMap[template]) {
      const mergeFields = adminEmailTemplates[template](params as any);
      await this.sendTemplate(
        template,
        [
          {
            to: {
              email: OptionsService.getText("support-email")
            },
            mergeFields
          }
        ],
        opts
      );
    }
  }

  async getTemplateEmail(
    template: EmailTemplateId
  ): Promise<false | Email | null> {
    const providerTemplate = this.providerTemplateMap[template];
    return providerTemplate
      ? await this.provider.getTemplateEmail(providerTemplate)
      : null;
  }

  async getTemplates(): Promise<EmailTemplate[]> {
    return await this.provider.getTemplates();
  }

  isTemplate(template: string): template is EmailTemplateId {
    return this.emailTemplateIds.includes(template as any);
  }

  get emailTemplateIds(): EmailTemplateId[] {
    return [
      ...(Object.keys(generalEmailTemplates) as GeneralEmailTemplateId[]),
      ...(Object.keys(adminEmailTemplates) as AdminEmailTemplateId[]),
      ...(Object.keys(memberEmailTemplates) as MemberEmailTemplateId[])
    ];
  }

  get providerTemplateMap(): Partial<Record<EmailTemplateId, string>> {
    return OptionsService.getJSON("email-templates");
  }

  memberToRecipient(
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

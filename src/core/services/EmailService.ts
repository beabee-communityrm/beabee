import moment from 'moment';

import { log as mainLogger } from '@core/logging';
import OptionsService from '@core/services/OptionsService';

import Member from '@models/Member';

import config from '@config';

import { EmailOptions, EmailPerson, EmailProvider, EmailRecipient, EmailTemplate } from './email';
import MandrillEmailProvider from './email/MandrillEmailProvider';
import SMTPEmailProvider from './email/SMTPEmailProvider';

const log = mainLogger.child({app: 'email-service'});

const emailTemplates = {
	'purchased-gift': (params: {fromName: string, gifteeFirstName: string, giftStartDate: Date}) => ({
		PURCHASER: params.fromName,
		GIFTEE: params.gifteeFirstName,
		GIFTDATE: moment.utc(params.giftStartDate).format('MMMM Do')
	}),
	'expired-special-url-resend': (params: {firstName: string, newUrl: string}) => ({
		FNAME: params.firstName,
		URL: params.newUrl
	})
} as const;

const memberEmailTemplates = {
	'welcome': (member: Member) => ({
		REFCODE: member.referralCode
	}),
	'welcome-post-gift': () => ({}),
	'reset-password': (member: Member) => ({
		RPLINK: config.audience + '/password-reset/code/' + member.password.resetCode
	}),
	'cancelled-contribution': (member: Member) => {
		const dateExpires = member.permissions.find(p => p.permission === 'member')?.dateExpires;
		return {
			EXPIRES: dateExpires ? moment.utc(dateExpires).format('dddd Do MMMM') : '-',
			MEMBERSHIPID: member.id
		};
	},
	'cancelled-contribution-no-survey': (member: Member) => {
		const dateExpires = member.permissions.find(p => p.permission === 'member')?.dateExpires;
		return {
			EXPIRES: dateExpires ? moment.utc(dateExpires).format('dddd Do MMMM') : '-'
		};
	},
	'restart-membership': (member: Member, params: {code: string}) => ({
		RESTARTLINK: config.audience + '/join/restart/' + params.code
	}),
	'successful-referral': (member: Member, params: {refereeName: string, isEligible: boolean}) => ({
		REFCODE: member.referralCode,
		REFEREENAME: params.refereeName,
		ISELIGIBLE: params.isEligible
	}),
	'giftee-success': (member: Member, params: {fromName: string, message: string, giftCode: string}) => ({
		PURCHASER: params.fromName,
		MESSAGE: params.message,
		ACTIVATELINK: config.audience + '/gift/' + params.giftCode
	})
} as const;

type EmailTemplates = typeof emailTemplates;
type EmailTemplateId = keyof EmailTemplates;
type MemberEmailTemplates = typeof memberEmailTemplates;
type MemberEmailTemplateId = keyof MemberEmailTemplates;
type MemberEmailParams<T extends MemberEmailTemplateId> = Parameters<MemberEmailTemplates[T]>[1]

class EmailService implements EmailProvider {

	private readonly provider: EmailProvider = config.email.provider === 'mandrill' ?
		new MandrillEmailProvider() : new SMTPEmailProvider()

	async sendEmail(from: EmailPerson, recipients: EmailRecipient[], subject: string, body: string, opts?: EmailOptions): Promise<void> {
		log.info({
			action: 'send-email',
			data: {
				from, recipients, subject
			}
		});
		await this.provider.sendEmail(from, recipients, subject, body, opts);
	}

	async sendTemplate(template: EmailTemplateId|MemberEmailTemplateId, recipients: EmailRecipient[], opts?: EmailOptions): Promise<void> {
		const providerTemplate = this.providerTemplateMap[template];
		log.info({
			action: 'send-template',
			data: {
				template, providerTemplate, recipients
			}
		});
		await this.provider.sendTemplate(providerTemplate, recipients, opts);
	}

	async sendTemplateTo<T extends EmailTemplateId>(
		template: T, to: EmailPerson, params: Parameters<EmailTemplates[T]>[0], opts?: EmailOptions
	): Promise<void> {
		const mergeFields = emailTemplates[template](params as any); // https://github.com/microsoft/TypeScript/issues/30581
		await this.sendTemplate(template, [{to, mergeFields}], opts);
	}

	async sendTemplateToMember<T extends MemberEmailTemplateId>(
		template: T, member: Member, params: MemberEmailParams<T>, opts?: EmailOptions
	): Promise<void>
	async sendTemplateToMember<T extends MemberEmailParams<T> extends undefined ? MemberEmailTemplateId : never>(
		template: T, member: Member, params?: undefined, opts?: EmailOptions
	): Promise<void>

	async sendTemplateToMember<T extends MemberEmailTemplateId>(
		template: T, member: Member, params: MemberEmailParams<T>, opts?: EmailOptions
	): Promise<void> {
		const mergeFields = {
			FNAME: member.firstname,
			...memberEmailTemplates[template](member, params as any) // https://github.com/microsoft/TypeScript/issues/30581
		};

		log.info({
			action: 'send-template-to-member',
			data: { memberId: member.id }
		});

		const recipients = [{to: {email: member.email, name: member.fullname}, mergeFields}];
		await this.sendTemplate(template, recipients, opts);
	}

	async sendRawTemplate(template: string, recipients: EmailRecipient[], opts?: EmailOptions): Promise<void> {
		log.info({
			action: 'send-raw-template',
			data: {
				template, recipients
			}
		});
		await this.provider.sendTemplate(template, recipients, opts);
	}

	async getTemplates(): Promise<EmailTemplate[]> {
		return await this.provider.getTemplates();
	}

	async getTemplate(template: string): Promise<EmailTemplate|undefined> {
		return await this.provider.getTemplate(template);
	}

	get emailTemplateIds(): (EmailTemplateId|MemberEmailTemplateId)[] {
		return [
			...Object.keys(emailTemplates) as EmailTemplateId[],
			...Object.keys(memberEmailTemplates) as MemberEmailTemplateId[]
		];
	}

	get providerTemplateMap() {
		return OptionsService.getJSON('email-templates');
	}
}

export default new EmailService();

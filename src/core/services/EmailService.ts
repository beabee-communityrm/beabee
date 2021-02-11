import moment from 'moment';

import { log as mainLogger } from '@core/logging';
import OptionsService from '@core/services/OptionsService';

import { Member } from '@models/members';

import config from '@config';

import { EmailOptions, EmailPerson, EmailProvider, EmailRecipient, EmailTemplate } from './email';
import MandrillEmailProvider from './email/MandrillEmailProvider';
import SMTPEmailProvider from './email/SMTPEmailProvider';

interface TemplateFn<T extends readonly string[]> {
	(params: {[P in T[number]]: unknown}): Record<string, unknown>
}

interface MemberTemplateFn<T extends readonly string[]> {
	(member: Member, params: {[P in T[number]]: unknown}): Record<string, unknown>
}

function wrapper2(fn: MemberTemplateFn<readonly []>): MemberTemplateFn<readonly []> {
	return wrapper([] as const, fn);
}

function wrapper<T extends readonly string[]>(keys: T, fn: MemberTemplateFn<T>): MemberTemplateFn<T> {
	return fn;
}

function wrapper3<T extends readonly string[]>(keys: T, fn: TemplateFn<T>): TemplateFn<T> {
	return fn;
}

const log = mainLogger.child({app: 'email-service'});

const emailTemplates = {
	'purchased-gift': wrapper3(
		['fromName', 'gifteeFirstName', 'giftStartDate'] as const,
		params => ({
			PURCHASER: params.fromName,
			GIFTEE: params.gifteeFirstName,
			GIFTDATE: moment.utc(params.giftStartDate as string).format('MMMM Do')
		})
	),
	'expired-special-url-resend': wrapper3(
		['firstName', 'newUrl'] as const,
		params => ({
			FNAME: params.firstName,
			URL: params.newUrl
		})
	)
} as const;

const memberEmailTemplates = {
	'welcome': wrapper2(member => ({
		REFLINK: member.referralLink
	})),
	'welcome-post-gift': wrapper2(() => ({})),
	'reset-password': wrapper2(member => ({
		RPLINK: config.audience + '/password-reset/code/' + member.password.reset_code
	})),
	'cancelled-contribution': wrapper2(member => ({
		EXPIRES: moment(member.memberPermission.date_expires).format('dddd Do MMMM'),
		MEMBERSHIPID: member.uuid
	})),
	'cancelled-contribution-no-survey': wrapper2(member => ({
		EXPIRES: moment(member.memberPermission.date_expires).format('dddd Do MMMM')
	})),
	'restart-membership': wrapper(['code'] as const, (member, {code}) => ({
		RESTARTLINK: config.audience + '/join/restart/' + code
	})),
	'successful-referral': wrapper(['refereeName', 'isEligible'] as const, (member, params) => ({
		REFLINK: member.referralLink,
		REFEREENAME: params.refereeName,
		ISELIGIBLE: params.isEligible
	})),
	'giftee-success': wrapper(['fromName', 'message'] as const, (member, params) => ({
		PURCHASER: params.fromName,
		MESSAGE: params.message,
		ACTIVATELINK: config.audience + '/gift/' + member.giftCode
	}))
} as const;

type MemberEmailTemplates = typeof memberEmailTemplates;
type MemberEmailTemplateId = keyof MemberEmailTemplates;
type EmailTemplateId = MemberEmailTemplateId | keyof typeof emailTemplates;

const emailProviders: {[key: string]: EmailProvider} = {
	mandrill: new MandrillEmailProvider(),
	smpt: new SMTPEmailProvider()
};

class EmailService implements EmailProvider {
	async sendEmail(from: EmailPerson, recipients: EmailRecipient[], subject: string, body: string, opts?: EmailOptions): Promise<void> {
		log.info({
			action: 'send-email',
			data: {
				from, recipients, subject
			}
		});
		await this.provider.sendEmail(from, recipients, subject, body, opts);
	}

	async sendTemplate(template: EmailTemplateId, recipients: EmailRecipient[], opts?: EmailOptions): Promise<void> {
		const providerTemplate = this.providerTemplateMap[template];
		log.info({
			action: 'send-template',
			data: {
				template, providerTemplate, recipients
			}
		});
		await this.provider.sendTemplate(template, recipients, opts);
	}

	async sendTemplateToMember<T extends MemberEmailTemplateId, P = MemberEmailTemplates[T] extends MemberTemplateFn<infer U> ? U : never>(
		template: T, member: Member, params?: any, opts?: EmailOptions
	): Promise<void> {
		const providerTemplate = this.providerTemplateMap[template];
		const mergeFields = {
			FNAME: member.firstname,
			...memberEmailTemplates[template](member, params)
		};

		log.info({
			action: 'send-template-to-member',
			data: {
				template, providerTemplate,
				memberId: member.id,
				mergeFields
			}
		});

		const recipients = [{to: {email: member.email, name: member.fullname}, mergeFields}];
		await this.provider.sendTemplate(providerTemplate, recipients, opts);
	}

	async getTemplates(): Promise<EmailTemplate[]> {
		return await this.provider.getTemplates();
	}

	private get provider(): EmailProvider {
		const provider = OptionsService.getText('email-provider');
		return emailProviders[provider];
	}

	private get providerTemplateMap() {
		return JSON.parse(OptionsService.getText('email-templates'));
	}
}

export default new EmailService();

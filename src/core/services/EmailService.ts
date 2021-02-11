import moment from 'moment';

import OptionsService from '@core/services/OptionsService';

import { Member } from '@models/members';

import config from '@config';

import { EmailOptions, EmailPerson, EmailProvider, EmailRecipient, EmailTemplate } from './email';
import MandrillEmailProvider from './email/MandrillEmailProvider';
import SMTPEmailProvider from './email/SMTPEmailProvider';

interface TemplateFn {
	(member: Member, params: Record<string, unknown>): {[key: string]: unknown}
}

const memberEmailTemplates: {[key: string]: TemplateFn} = {
	'welcome': member => ({
		REFLINK: member.referralLink
	}),
	'welcome-post-gift': () => ({}),
	'reset-password': member => ({
		RPLINK: config.audience + '/password-reset/code/' + member.password.reset_code
	}),
	'cancelled-contribution': member => ({
		EXPIRES: moment(member.memberPermission.date_expires).format('dddd Do MMMM'),
		MEMBERSHIPID: member.uuid
	}),
	'cancelled-contribution-no-survey': member => ({
		EXPIRES: moment(member.memberPermission.date_expires).format('dddd Do MMMM')
	}),
	'restart-membership': (member, {code}) => ({
		RESTARTLINK: config.audience + '/join/restart/' + code
	}),
	'successful-referral': (member, {refereeName, isEligible}) => ({
		REFLINK: member.referralLink,
		REFEREENAME: refereeName,
		ISELIGIBLE: isEligible
	}),
	'giftee-success': (member, {fromName, message}) => ({
		PURCHASER: fromName,
		MESSAGE: message,
		ACTIVATELINK: config.audience + '/gift/' + member.giftCode
	})
};

const emailProviders: {[key: string]: EmailProvider} = {
	mandrill: new MandrillEmailProvider(),
	smpt: new SMTPEmailProvider()
};

class EmailService implements EmailProvider {
	async sendEmail(from: EmailPerson, recipients: EmailRecipient[], subject: string, body: string, opts?: EmailOptions): Promise<void> {
		await this.provider.sendEmail(from, recipients, subject, body, opts);
	}

	async sendTemplate(template: string, recipients: EmailRecipient[], opts?: EmailOptions): Promise<void> {
		await this.provider.sendTemplate(template, recipients, opts);
	}

	async sendTemplateToMember(template: string, member: Member, params?: Record<string, unknown>, opts?: EmailOptions): Promise<void> {
		const mergeFields = {
			FNAME: member.firstname,
			...memberEmailTemplates[template](member, params || {})
		};
		const providerTemplate = this.providerTemplateMap[template];
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

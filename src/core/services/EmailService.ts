import moment from 'moment';

import OptionsService from '@core/services/OptionsService';

import { Member } from '@models/members';

import config from '@config';

import { EmailProvider, Template } from './email';
import MandrillEmailProvider from './email/MandrillEmailProvider';
import LocalEmailProvider from './email/LocalEmailProvider';

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
	}),
	'expired-special-url-resend': (member, {url}) => ({
		URL: url
	})
};

const emailProviders: {[key: string]: EmailProvider} = {
	mandrill: new MandrillEmailProvider(),
	local: new LocalEmailProvider()
};

export default class EmailService {
	static async send(template: string): Promise<void> {
		//await EmailService.getProvider().send(templates[template]);
	}

	static async sendToMember(template: string, member: Member, params?: Record<string, unknown>, sendAt?: string): Promise<void> {
		const mergeFields = memberEmailTemplates[template](member, params || {});
		const providerTemplate = this.providerTemplateMap[template];
		await EmailService.provider.sendToMember(member, providerTemplate, mergeFields, sendAt);
	}

	static async getTemplates(): Promise<Template[]> {
		return await EmailService.provider.getTemplates();
	}

	private static get providerTemplateMap() {
		return JSON.parse(OptionsService.getText('email-templates'));
	}

	private static get provider(): EmailProvider {
		const provider = OptionsService.getText('email-provider');
		return emailProviders[provider];
	}
}

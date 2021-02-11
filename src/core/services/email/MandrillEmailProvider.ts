import mandrill from 'mandrill-api/mandrill';
import { getRepository } from 'typeorm';

import OptionsService from '@core/services/OptionsService';

import Email from '@models/Email';
import { Member } from '@models/members';

import { EmailProvider, Template } from '.';

interface MandrillTemplate {
	slug: string
	name: string
}

interface MandrillMessage {
	to: {email: string, name: string}[]
	merge_vars: {
		rcpt: string,
		vars: {name: string, content: unknown}[]
	}[]
}

export default class MandrillEmailProvider implements EmailProvider {
	async getTemplates(): Promise<Template[]> {
		const templates: MandrillTemplate[] = await new Promise((resolve, reject) => {
			this.client.templates.list(resolve, reject);
		});

		const emails = await getRepository(Email).find();

		return [
			...emails.map(email => ({id: 'local_' + email.id, name: email.name})),
			...templates.map(template => ({id: 'mandrill_' + template.slug, name: template.name}))
		];
	}

	async sendToMember(member: Member, templateId: string, mergeFields: Record<string, unknown>, sendAt?: string): Promise<void> {
		const message = this.memberToMessage(member, mergeFields);
		await this.sendTemplate(templateId, message, sendAt);
	}

	private get client() {
		return new mandrill.Mandrill(OptionsService.getText('email-settings'));
	}
	
	private memberToMessage(member: Member, params: Record<string, unknown>): MandrillMessage {
		const mergeVars = Object.keys(params).map(key => ({
			name: key,
			content: params[key]
		}));

		return {
			to: [{
				email: member.email,
				name: member.fullname
			}],
			merge_vars: [{
				rcpt: member.email,
				vars: [
					{
						name: 'FNAME',
						content: member.firstname
					},
					...mergeVars
				]
			}],
		};
	}

	private async sendTemplate(templateId: string, message: MandrillMessage, sendAt?: string): Promise<void> {
		if (templateId.startsWith('mandrill_')) {
			await new Promise((resolve, reject) => {
				this.client.messages.sendTemplate({
					template_name: templateId,
					template_content: [],
					message,
					...(sendAt ? {send_at: sendAt} : {})
				}, resolve, reject);
			});
		} else {
			const email = await getRepository(Email).findOne(templateId.replace('local_', ''));
			if (email) {
				await new Promise((resolve, reject) => {
					this.client.messages.send({
						from_email: email.fromEmail,
						from_name: email.fromName,
						html: email.body.replace(/\r\n/g, '<br/>'),
						auto_text: true,
						subject: email.subject,
						...message
					}, resolve, reject);
				});
			}
		}
	}
}

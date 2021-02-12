import mandrill from 'mandrill-api/mandrill';
import { getRepository } from 'typeorm';

import { log as mainLogger } from '@core/logging';
import OptionsService from '@core/services/OptionsService';

import Email from '@models/Email';

import { EmailOptions, EmailPerson, EmailProvider, EmailRecipient, EmailTemplate } from '.';

const log = mainLogger.child({app: 'mandrill-email-provider'});

interface MandrillTemplate {
	slug: string
	name: string
}

interface MandrillMessage {
	to: {email: string, name: string}[]
	merge_vars: {
		rcpt: string,
		vars?: {name: string, content: unknown}[]
	}[],
	attachments?: {type: string, name: string, content: string}[]
}

export default class MandrillEmailProvider implements EmailProvider {
	async sendEmail(from: EmailPerson, recipients: EmailRecipient[], subject: string, body: string, opts?: EmailOptions): Promise<void> {
		const resp = await new Promise((resolve, reject) => {
			this.client.messages.send({
				message: {
					...this.createMessageData(recipients, opts),
					from_name: from.name,
					from_email: from.email,
					subject,
					html: body,
					auto_text: true
				},
				...opts?.sendAt && {send_at: opts.sendAt}
			}, resolve, reject);
		});

		log.debug({
			action: 'sent-email',
			data: resp
		});
	}

	async sendTemplate(template: string, recipients: EmailRecipient[], opts?: EmailOptions): Promise<void> {
		const [templateType, templateId] = template.split('_', 2);

		log.debug({
			action: 'send-template',
			data: {
				templateType, templateId
			}
		});

		if (templateType === 'mandrill') {
			const resp = await new Promise((resolve, reject) => {
				this.client.messages.sendTemplate({
					...this.createMessageData(recipients, opts),
					template_name: templateId,
					template_content: [],
					...opts?.sendAt && {send_at: opts.sendAt}
				}, resolve, reject);
			});
			log.debug({
				action: 'sent-template',
				data: resp
			});
		} else if (templateType === 'local') {
			const email = await getRepository(Email).findOne(templateId);
			if (email) {
				this.sendEmail(
					{email: email.fromEmail, name: email.fromName},
					recipients,
					email.subject,
					email.body.replace(/\r\n/g, '<br/>'),
					opts
				);
			}
		}
	}

	async getTemplates(): Promise<EmailTemplate[]> {
		const templates: MandrillTemplate[] = await new Promise((resolve, reject) => {
			this.client.templates.list(resolve, reject);
		});

		const emails = await getRepository(Email).find();

		return [
			...emails.map(email => ({id: 'local_' + email.id, name: email.name})),
			...templates.map(template => ({id: 'mandrill_' + template.slug, name: template.name}))
		];
	}

	private get client() {
		return new mandrill.Mandrill(OptionsService.getText('email-settings'));
	}
	
	private createMessageData(recipients: EmailRecipient[], opts?: EmailOptions): MandrillMessage {
		return {
			to: recipients.map(r => r.to),
			merge_vars: recipients.map(r => ({
				rcpt: r.to.email,
				vars: r.mergeFields && Object.keys(r.mergeFields).map(mergeField => ({
					name: mergeField,
					content: r.mergeFields![mergeField]
				}))
			})),
			...opts?.attachments && {attachments: opts.attachments}
		};
	}
}

import nodemailer from 'nodemailer';
import { getRepository } from 'typeorm';

import { log as mainLogger } from '@core/logging';
import OptionsService from '@core/services/OptionsService';

import Email from '@models/Email';

import { EmailOptions, EmailPerson, EmailProvider, EmailRecipient, EmailTemplate } from '.';

const log = mainLogger.child({app: 'smtp-email-provider'});

export default class SMTPEmailProvider implements EmailProvider {
	async sendEmail(from: EmailPerson, recipients: EmailRecipient[], subject: string, body: string, opts?: EmailOptions): Promise<void> {
		if (opts?.sendAt) {
			log.error({error: 'send-at-not-supported'}, 'SMTPEmailProvider doesn\'t support sendAt, ignoring email');
			return;
		}

		for (const recipient of recipients) {
			const mergedBody = Object.keys(recipient.mergeFields || {}).reduce((field, body) => {
				return body.replace(new RegExp(`*|${field}|*`, 'g'), '' + recipient.mergeFields![field]);
			}, body);

			await this.client.sendMail({
				from: {name: from.name, address: from.email},
				to: {name: recipient.to.name, address: recipient.to.email},
				subject,
				html: mergedBody,
				...opts?.attachments && {
					attachments: opts.attachments.map(a => ({
						filename: a.name,
						contentType: a.type,
						content: a.content
					}))
				}
			});
		}

		throw new Error('Method not implemented.');
	}
	async sendTemplate(template: string, recipients: EmailRecipient[], opts?: EmailOptions): Promise<void> {
		const email = await getRepository(Email).findOne(template);
		if (email) {
			this.sendEmail(
				{name: email.fromName, email: email.fromEmail},
				recipients,
				email.subject,
				email.body.replace(/\r\n/g, '<br/>'),
				opts
			);
		}
	}

	async getTemplates(): Promise<EmailTemplate[]> {
		const emails = await getRepository(Email).find();
		return emails.map(email => ({id: email.id, name: email.name}));
	}

	private get client() {
		return nodemailer.createTransport(JSON.parse(OptionsService.getText('email-settings')));
	}
}

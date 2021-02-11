import { getRepository } from 'typeorm';

import Email from '@models/Email';

import { EmailOptions, EmailPerson, EmailProvider, EmailRecipient, EmailTemplate } from '.';

export default class SMTPEmailProvider implements EmailProvider {
	sendEmail(from: EmailPerson, recipients: EmailRecipient[], subject: string, body: string, opts?: EmailOptions): Promise<void> {
		throw new Error('Method not implemented.');
	}
	sendTemplate(template: string, recipients: EmailRecipient[], opts?: EmailOptions): Promise<void> {
		throw new Error('Method not implemented.');
	}

	async getTemplates(): Promise<EmailTemplate[]> {
		const emails = await getRepository(Email).find();
		return emails.map(email => ({id: email.id, name: email.name}));
	}
}

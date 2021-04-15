interface EmailTemplate {
	id: string
	name: string
}

type EmailMergeFields = Record<string, unknown>;

interface EmailPerson {
	email: string
	name: string
}

interface EmailRecipient {
	to: EmailPerson,
	mergeFields?: EmailMergeFields
}

interface EmailAttachment {
	type: string
	name: string
	content: string
}

interface EmailOptions {
	attachments?: EmailAttachment[],
	sendAt?: string
}

interface EmailProvider {
	sendEmail(from: EmailPerson, recipients: EmailRecipient[], subject: string, body: string, opts?: EmailOptions): Promise<void>
	sendTemplate(template: string, recipients: EmailRecipient[], opts?: EmailOptions): Promise<void>
	getTemplates(): Promise<EmailTemplate[]>
	getTemplate(templateId: string): Promise<EmailTemplate|undefined>
}

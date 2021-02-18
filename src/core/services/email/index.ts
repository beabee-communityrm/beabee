export interface EmailTemplate {
	id: string
	name: string
}

export type EmailMergeFields = Record<string, unknown>;

export interface EmailPerson {
	email: string
	name: string
}

export interface EmailRecipient {
	to: EmailPerson,
	mergeFields?: EmailMergeFields
}

export interface EmailAttachment {
	type: string
	name: string
	content: string
}

export interface EmailOptions {
	attachments?: EmailAttachment[],
	sendAt?: string
}

export interface EmailProvider {
	sendEmail(from: EmailPerson, recipients: EmailRecipient[], subject: string, body: string, opts?: EmailOptions): Promise<void>
	sendTemplate(template: string, recipients: EmailRecipient[], opts?: EmailOptions): Promise<void>
	getTemplates(): Promise<EmailTemplate[]>
	getTemplate(templateId: string): Promise<EmailTemplate|undefined>
}

import { Member } from '@models/members';

interface Template {
	id: string
	name: string
}

interface EmailProvider {
	getTemplates(): Promise<Template[]>
	sendToMember(member: Member, template: string, mergeFields: Record<string, unknown>, sendAt?: string): Promise<void>
}

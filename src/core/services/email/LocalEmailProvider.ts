import { Member } from '@models/members';
import { EmailProvider, Template } from '.';

export default class LocalEmailProvider implements EmailProvider {
	getTemplates(): Promise<Template[]> {
		throw new Error('Method not implemented.');
	}
	sendToMember(member: Member, template: string, mergeFields: Record<string, unknown>, sendAt?: string): Promise<void> {
		throw new Error('Method not implemented.');
	}
}

import Member from '@models/Member';

import { NewsletterProvider } from '.';

export default class NoneProvider implements NewsletterProvider {
	async updateMember(listId: string, member: Member, oldEmail?: string): Promise<void> {
	}
	async updateMemberFields(listId: string, member: Member, fields: Record<string, string>): Promise<void> {
	}
	async upsertMembers(listId: string, members: Member[], groups?: string[]): Promise<void> {
	}
	async archiveMembers(listId: string, members: Member[]): Promise<void> {
	}
	async deleteMembers(listId: string, members: Member[]): Promise<void> {
	}
}

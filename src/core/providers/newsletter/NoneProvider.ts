import Member from '@models/Member';

import { NewsletterProvider } from '.';

export default class NoneProvider implements NewsletterProvider {
	async updateMember(member: Member, oldEmail?: string): Promise<void> {
	}
	async updateMemberFields(member: Member, fields: Record<string, string>): Promise<void> {
	}
	async upsertMembers(members: Member[], groups?: string[]): Promise<void> {
	}
	async archiveMembers(members: Member[]): Promise<void> {
	}
	async deleteMembers(members: Member[]): Promise<void> {
	}
}

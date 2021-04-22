import Member from '@models/Member';

export interface NewsletterProvider {
	updateMember(member: Member, oldEmail?: string): Promise<void>
	updateMemberFields(member: Member, fields: Record<string, string>): Promise<void>
	upsertMembers(members: Member[], groups?: string[]): Promise<void>
	archiveMembers(members: Member[]): Promise<void>
	deleteMembers(members: Member[]): Promise<void>
}

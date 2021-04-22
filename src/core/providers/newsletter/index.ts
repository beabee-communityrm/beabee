import Member from '@models/Member';

export interface NewsletterProvider {
	addTagToMembers(members: Member[], tag: string): Promise<void>
	removeTagFromMembers(members: Member[], tag: string): Promise<void>
	updateMember(member: Member, oldEmail?: string): Promise<void>
	updateMemberFields(member: Member, fields: Record<string, string>): Promise<void>
	upsertMembers(members: Member[], optIn: boolean, groups?: string[]): Promise<void>
	archiveMembers(members: Member[]): Promise<void>
	deleteMembers(members: Member[]): Promise<void>
}

import Member from '@models/Member';

export interface NewsletterProvider {
	updateMember(listId: string, member: Member, oldEmail?: string): Promise<void>
	upsertMembers(listId: string, members: Member[]): Promise<void>
	archiveMembers(listId: string, members: Member[]): Promise<void>
	deleteMembers(listId: string, members: Member[]): Promise<void>
}

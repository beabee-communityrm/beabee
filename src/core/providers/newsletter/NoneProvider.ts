import { NewsletterMember, NewsletterProvider } from '.';

export default class NoneProvider implements NewsletterProvider {
	async addTagToMembers(emails: string[], tag: string): Promise<void> {
	}
	async removeTagFromMembers(emails: string[], tag: string): Promise<void> {
	}
	async getMembers(): Promise<NewsletterMember[]> {
		return [];
	}
	async insertMembers(members: NewsletterMember[]): Promise<void> {
	}
	async updateMember(member: NewsletterMember, oldEmail?: string): Promise<void> {
	}
	async updateMembers(members: NewsletterMember[]): Promise<void> {
	}
	async archiveMembers(emails: string[]): Promise<void> {
	}
	async deleteMembers(emails: string[]): Promise<void> {
	}
}

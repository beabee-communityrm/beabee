import { NewsletterMember, NewsletterProvider } from '.';

export default class NoneProvider implements NewsletterProvider {
	addTagToMembers(emails: string[], tag: string): Promise<void> {
		throw new Error('Method not implemented.');
	}
	removeTagFromMembers(emails: string[], tag: string): Promise<void> {
		throw new Error('Method not implemented.');
	}
	getMembers(): Promise<NewsletterMember[]> {
		throw new Error('Method not implemented.');
	}
	updateMember(member: NewsletterMember, oldEmail?: string): Promise<void> {
		throw new Error('Method not implemented.');
	}
	upsertMembers(members: NewsletterMember[]): Promise<void> {
		throw new Error('Method not implemented.');
	}
	archiveMembers(emails: string[]): Promise<void> {
		throw new Error('Method not implemented.');
	}
	deleteMembers(emails: string[]): Promise<void> {
		throw new Error('Method not implemented.');
	}
}

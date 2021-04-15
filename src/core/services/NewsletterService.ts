import { NewsletterProvider } from '@core/providers/newsletter';
import MailchimpProvider from '@core/providers/newsletter/MailchimpProvider';

import Member from '@models/Member';

import config from '@config';

class NewsletterService implements NewsletterProvider {
	private readonly provider: NewsletterProvider = new MailchimpProvider(config.newsletter.settings);

	async updateMember(listId: string, member: Member, oldEmail = member.email): Promise<void> {
		await this.provider.updateMember(listId, member, oldEmail);
	}
	async upsertMembers(listId: string, members: Member[]): Promise<void> {
		await this.provider.upsertMembers(listId, members);
	}
	async archiveMembers(listId: string, members: Member[]): Promise<void> {
		await this.provider.archiveMembers(listId, members);
	}
	async deleteMembers(listId: string, members: Member[]): Promise<void> {
		await this.provider.deleteMembers(listId, members);
	}
}

export default new NewsletterService();

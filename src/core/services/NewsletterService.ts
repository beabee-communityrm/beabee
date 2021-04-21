import { NewsletterProvider } from '@core/providers/newsletter';
import MailchimpProvider from '@core/providers/newsletter/MailchimpProvider';

import Member from '@models/Member';

import config from '@config';
import OptionsService from './OptionsService';

class NewsletterService {
	private readonly provider: NewsletterProvider = new MailchimpProvider(config.newsletter.settings);

	async updateMember(listId: string = OptionsService.getText('newsletter-main-list'), member: Member, oldEmail = member.email): Promise<void> {
		await this.provider.updateMember(listId, member, oldEmail);
	}
	async upsertMembers(listId: string = OptionsService.getText('newsletter-main-list'), members: Member[]): Promise<void> {
		await this.provider.upsertMembers(listId, members);
	}
	async archiveMembers(listId: string = OptionsService.getText('newsletter-main-list'), members: Member[]): Promise<void> {
		await this.provider.archiveMembers(listId, members);
	}
	async deleteMembers(listId: string = OptionsService.getText('newsletter-main-list'), members: Member[]): Promise<void> {
		await this.provider.deleteMembers(listId, members);
	}
}

export default new NewsletterService();

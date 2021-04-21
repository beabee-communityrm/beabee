import { NewsletterProvider } from '@core/providers/newsletter';
import MailchimpProvider from '@core/providers/newsletter/MailchimpProvider';

import OptionsService from '@core/services/OptionsService';

import Member from '@models/Member';

import config from '@config';

class NewsletterService {
	private readonly provider: NewsletterProvider = new MailchimpProvider(config.newsletter.settings);

	get mainList() {
		return new MainNewsletterList(this.provider);
	}

	list(listId: string) {
		return new NewsletterList(listId, this.provider);
	}
}

class NewsletterList {
	constructor(readonly listId: string, readonly provider: NewsletterProvider) {}

	async updateMember(member: Member, oldEmail = member.email): Promise<void> {
		await this.provider.updateMember(this.listId, member, oldEmail);
	}
	async updateMemberFields(member: Member, fields: Record<string, string>) {
		await this.provider.updateMemberFields(this.listId, member, fields);
	}
	async upsertMembers(members: Member[]): Promise<void> {
		await this.provider.upsertMembers(this.listId, members);
	}
	async archiveMembers(members: Member[]): Promise<void> {
		await this.provider.archiveMembers(this.listId, members);
	}
	async deleteMembers(members: Member[]): Promise<void> {
		await this.provider.deleteMembers(this.listId, members);
	}
}

class MainNewsletterList extends NewsletterList {
	constructor(readonly provider: NewsletterProvider) {
		super(OptionsService.getText('newsletter-main-list'), provider);
	}

	async upsertMembers(members: Member[]): Promise<void> {
		await this.provider.upsertMembers(this.listId, members, OptionsService.getList('newsletter-main-list-groups'));
	}
}

export default new NewsletterService();

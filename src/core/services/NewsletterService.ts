import { log as mainLogger } from '@core/logging';

import { NewsletterProvider } from '@core/providers/newsletter';
import MailchimpProvider from '@core/providers/newsletter/MailchimpProvider';
import NoneProvider from '@core/providers/newsletter/NoneProvider';

import OptionsService from '@core/services/OptionsService';

import Member from '@models/Member';

import config from '@config';

const log = mainLogger.child({app: 'newsletter-service'});

class NewsletterService {
	private readonly provider: NewsletterProvider = config.newsletter.provider === 'mailchimp' ?
		new MailchimpProvider(config.newsletter.settings) : new NoneProvider();

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
		log.info({action: 'update-member', data: {memberId: member.id}});
		await this.provider.updateMember(this.listId, member, oldEmail);
	}
	async updateMemberFields(member: Member, fields: Record<string, string>) {
		log.info({action: 'update-member-fields', data: {memberId: member.id, fields}});
		await this.provider.updateMemberFields(this.listId, member, fields);
	}
	async upsertMembers(members: Member[]): Promise<void> {
		log.info({action: 'upsert-members'});
		await this.provider.upsertMembers(this.listId, members);
	}
	async archiveMembers(members: Member[]): Promise<void> {
		log.info({action: 'archive-members'});
		await this.provider.archiveMembers(this.listId, members);
	}
	async deleteMembers(members: Member[]): Promise<void> {
		log.info({action: 'delete-members'});
		await this.provider.deleteMembers(this.listId, members);
	}
}

class MainNewsletterList extends NewsletterList {
	constructor(readonly provider: NewsletterProvider) {
		super(OptionsService.getText('newsletter-main-list'), provider);
	}

	async upsertMembers(members: Member[]): Promise<void> {
		log.info({action: 'upsert-members-main'});
		await this.provider.upsertMembers(this.listId, members, OptionsService.getList('newsletter-main-list-groups'));
	}
}

export default new NewsletterService();

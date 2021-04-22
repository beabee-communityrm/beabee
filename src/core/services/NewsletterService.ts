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
		new MailchimpProvider(config.newsletter.settings as any) :
		new NoneProvider();

	async addTagToMembers(members: Member[], tag: string): Promise<void> {
		log.info({action: 'add-tag-to-members', data: {tag}});
		await this.provider.addTagToMembers(members, tag);
	}

	async removeTagFromMembers(members: Member[], tag: string): Promise<void> {
		log.info({action: 'remove-tag-from-members', data: {tag}});
		await this.provider.removeTagFromMembers(members, tag);
	}

	async updateMember(member: Member, oldEmail = member.email): Promise<void> {
		log.info({action: 'update-member', data: {memberId: member.id}});
		await this.provider.updateMember(member, oldEmail);
	}

	async updateMemberFields(member: Member, fields: Record<string, string>) {
		log.info({action: 'update-member-fields', data: {memberId: member.id, fields}});
		await this.provider.updateMemberFields(member, fields);
	}

	async upsertMembers(members: Member[]): Promise<void> {
		log.info({action: 'upsert-members'});
		await this.provider.upsertMembers(members, OptionsService.getList('newsletter-default-groups'));
	}

	async archiveMembers(members: Member[]): Promise<void> {
		log.info({action: 'archive-members'});
		await this.provider.archiveMembers(members);
	}

	async deleteMembers(members: Member[]): Promise<void> {
		log.info({action: 'delete-members'});
		await this.provider.deleteMembers(members);
	}
}

export default new NewsletterService();

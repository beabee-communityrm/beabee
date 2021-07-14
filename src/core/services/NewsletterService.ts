import { getRepository } from 'typeorm';

import { log as mainLogger } from '@core/logging';

import OptionsService from '@core/services/OptionsService';

import { NewsletterMember, NewsletterProvider, NewsletterStatus, PartialNewsletterMember } from '@core/providers/newsletter';
import MailchimpProvider from '@core/providers/newsletter/MailchimpProvider';
import NoneProvider from '@core/providers/newsletter/NoneProvider';

import Member from '@models/Member';
import MemberProfile from '@models/MemberProfile';

import config from '@config';

const log = mainLogger.child({app: 'newsletter-service'});

function shouldUpdate(updates: Partial<Member>): boolean {
	return !!(
		updates.email || updates.firstname || updates.lastname || updates.referralCode ||
		updates.pollsCode || updates.contributionPeriod || updates.contributionMonthlyAmount
	);
}

function memberToNlMember(member: Member): PartialNewsletterMember {
	return {
		email: member.email,
		firstname: member.firstname,
		lastname: member.lastname,
		fields: {
			REFCODE: member.referralCode || '',
			POLLSCODE: member.pollsCode || '',
			C_DESC: member.contributionDescription,
			C_MNTHAMT: member.contributionMonthlyAmount?.toString() || '',
			C_PERIOD: member.contributionPeriod || ''
		}
	};
}

class NewsletterService {
	private readonly provider: NewsletterProvider = config.newsletter.provider === 'mailchimp' ?
		new MailchimpProvider(config.newsletter.settings as any) :
		new NoneProvider();

	async addTagToMembers(members: Member[], tag: string): Promise<void> {
		log.info({action: 'add-tag-to-members', data: {tag}});
		await this.provider.addTagToMembers(members.map(m => m.email), tag);
	}

	async removeTagFromMembers(members: Member[], tag: string): Promise<void> {
		log.info({action: 'remove-tag-from-members', data: {tag}});
		await this.provider.removeTagFromMembers(members.map(m => m.email), tag);
	}

	async updateMemberIfNeeded(member: Member, updates: Partial<Member>, oldEmail?: string): Promise<void> {
		const willUpdate = shouldUpdate(updates);
		log.info({action: 'update-member', data: {memberId: member.id, willUpdate}});
		if (willUpdate) {
			await this.provider.updateMember(memberToNlMember(member), oldEmail);
		}
	}

	async updateMembers(members: Member[]): Promise<void> {
		await this.provider.updateMembers(members.map(memberToNlMember));
	}

	async updateMemberStatuses(members: Member[]): Promise<void> {
		log.info({action: 'update-member-statuses'});

		await this.provider.updateMembers(members.map(member => ({
			email: member.email,
			status: member.profile.newsletterStatus,
			groups: member.profile.newsletterGroups
		})));
	}

	async updateMemberFields(member: Member, fields: Record<string, string>): Promise<void> {
		log.info({action: 'update-member-fields', data: {memberId: member.id, fields}});
		await this.provider.updateMember({email: member.email, fields});
	}

	async insertMembers(members: Member[]): Promise<void> {
		log.info({action: 'insert-members'});
		await this.provider.insertMembers(members.map(member => ({
			...memberToNlMember(member),
			status: member.profile.newsletterStatus,
			groups: member.profile.newsletterGroups
		})));

		const activeMemberEmails = members.filter(m => m.isActiveMember).map(m => m.email);
		await this.provider.addTagToMembers(activeMemberEmails, OptionsService.getText('newsletter-active-member-tag'));
	}

	async archiveMembers(members: Member[]): Promise<void> {
		log.info({action: 'archive-members'});
		await this.provider.archiveMembers(members.map(m => m.email));
	}

	async deleteMembers(members: Member[]): Promise<void> {
		log.info({action: 'delete-members'});
		await this.provider.deleteMembers(members.map(m => m.email));
	}

	async getNewsletterMembers(): Promise<NewsletterMember[]> {
		return await this.provider.getMembers();
	}
}

export default new NewsletterService();

import { Request, Response } from 'express';
import { getRepository } from 'typeorm';

import gocardless from '@core/lib/gocardless';
import { log } from '@core/logging';
import { isDuplicateIndex } from '@core/utils';
import { AuthenticationStatus, canAdmin, generateCode } from '@core/utils/auth';

import EmailService from '@core/services/EmailService';
import NewsletterService from '@core/services/NewsletterService';
import OptionsService from '@core/services/OptionsService';

import GCPaymentData from '@models/GCPaymentData';
import Member from '@models/Member';
import MemberProfile from '@models/MemberProfile';
import MemberPermission, { PermissionType } from '@models/MemberPermission';

export type PartialMember = Pick<Member,'email'|'firstname'|'lastname'|'contributionType'>&Partial<Member>
export type PartialMemberProfile = Pick<MemberProfile,'deliveryOptIn'>&Partial<MemberProfile>

export default class MembersService {
	static generateMemberCode(member: Pick<Member,'firstname'|'lastname'>): string|undefined {
		if (member.firstname && member.lastname) {
			const no = ('000' + Math.floor(Math.random() * 1000)).slice(-3);
			return (member.firstname[0] + member.lastname[0] + no).toUpperCase();
		}
	}

	static async createMember(partialMember: PartialMember, partialProfile: PartialMemberProfile): Promise<Member> {
		try {
			const member = getRepository(Member).create({
				referralCode: this.generateMemberCode(partialMember),
				pollsCode: this.generateMemberCode(partialMember),
				permissions: [],
				password: {
					hash: '',
					salt: '',
					iterations: 0,
					tries: 0
				},
				...partialMember,
			});
			await getRepository(Member).save(member);

			const profile = getRepository(MemberProfile).create({
				...partialProfile,
				member
			});
			await getRepository(MemberProfile).save(profile);

			await NewsletterService.upsertMembers([member]);

			return member;
		} catch (error) {
			if (isDuplicateIndex(error, 'referralCode') || isDuplicateIndex(error, 'pollsCode')) {
				return await MembersService.createMember(partialMember, partialProfile);
			}
			throw error;
		}
	}

	static async optMemberIntoNewsletter(member: Member): Promise<void> {
		try {
			await NewsletterService.upsertMembers([member]);
			await NewsletterService.updateMemberStatus(member, 'subscribed', OptionsService.getList('newsletter-default-groups'));
			await NewsletterService.addTagToMembers([member], OptionsService.getText('newsletter-active-member-tag'));
		} catch (err) {
			log.error({
				app: 'join-utils',
				error: err,
			}, 'Failed to add member to newsletter, probably a bad email address: ' + member.id);
		}
	}

	static async updateMember(member: Member, updates: Partial<Member>): Promise<void> {
		log.info( {
			app: 'members-service',
			action: 'update-member',
			sensitive: {
				memberId: member.id,
				updates
			}
		} );

		await NewsletterService.updateMember(member, updates);

		// TODO: This should be in GCPaymentService
		const needsGcSync = updates.email && updates.email !== member.email ||
			updates.firstname && updates.firstname !== member.firstname ||
			updates.lastname && updates.lastname !== member.lastname;
		if (needsGcSync) {
			const gcData = await getRepository(GCPaymentData).findOne({member});
			if ( gcData && gcData.customerId) {
				await gocardless.customers.update( gcData.customerId, {
					email: updates.email,
					given_name: updates.firstname,
					family_name: updates.lastname
				} );
			}
		}

		member = Object.assign(member, 	updates);
		await getRepository(Member).update(member.id, updates);
	}

	static async updateMemberPermission(member: Member, permission: PermissionType, updates?: Partial<Omit<MemberPermission, 'member'|'permission'>>): Promise<void> {
		const wasInactive = member.isActiveMember;

		const existingPermission = member.permissions.find(p => p.permission === permission);
		if (existingPermission && updates) {
			Object.assign(existingPermission, updates);
			await getRepository(MemberPermission).update({member, permission}, updates);
		} else {
			const newPermission = getRepository(MemberPermission).create({permission, ...updates});
			member.permissions.push(newPermission);
			await getRepository(MemberPermission).insert(newPermission);
		}
		if (!wasInactive && member.isActiveMember) {
			MembersService.optMemberIntoNewsletter(member);
		}
	}

	static async updateMemberProfile(member: Member, updates: Partial<MemberProfile>): Promise<void> {
		await getRepository(MemberProfile).update(member.id, updates);
	}

	static async resetMemberPassword(email: string): Promise<void> {
		const member = await getRepository(Member).findOne({email});
		if (member) {
			member.password.resetCode = generateCode();
			await getRepository(Member).save(member);
			await EmailService.sendTemplateToMember('reset-password', member);
		}
	}

	static loginAndRedirect(req: Request, res: Response, member: Member, url?: string): void {
		req.login(member as Express.User, function (loginError) {
			if (loginError) {
				throw loginError;
			} else {
				if (!url) {
					url =  OptionsService.getText(canAdmin(req) === AuthenticationStatus.LOGGED_IN ? 'admin-home-url' : 'user-home-url');
				}
				res.redirect(url);
			}
		});
	}

	static async permanentlyDeleteMember(member: Member): Promise<void> {
		await getRepository(Member).delete(member.id);
		await NewsletterService.deleteMembers([member]);
	}
}

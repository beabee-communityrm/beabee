import { Request, Response } from 'express';
import { getRepository } from 'typeorm';

import gocardless from '@core/lib/gocardless';
import { log } from '@core/logging';
import mailchimp from '@core/lib/mailchimp';
import { isDuplicateIndex } from '@core/utils';
import { AuthenticationStatus, canAdmin, generateCode } from '@core/utils/auth';

import EmailService from '@core/services/EmailService';
import OptionsService from '@core/services/OptionsService';

import GCPaymentData from '@models/GCPaymentData';
import Member from '@models/Member';
import MemberProfile from '@models/MemberProfile';

export type PartialMember = Pick<Member,'email'|'firstname'|'lastname'|'contributionType'>&Partial<Member>
export type PartialMemberProfile = Pick<MemberProfile,'deliveryOptIn'>&Partial<MemberProfile>

export default class MembersService {
	static generateMemberCode(member: Pick<Member,'firstname'|'lastname'>): string {
		const no = ('000' + Math.floor(Math.random() * 1000)).slice(-3);
		return (member.firstname[0] + member.lastname[0] + no).toUpperCase();
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

			return member;
		} catch (error) {
			if (isDuplicateIndex(error, 'referralCode') || isDuplicateIndex(error, 'pollsCode')) {
				return await MembersService.createMember(partialMember, partialProfile);
			}
			throw error;
		}
	}

	static async addMemberToMailingLists(member: Member): Promise<void> {
		try {
			await mailchimp.mainList.addMember(member);
		} catch (err) {
			log.error({
				app: 'join-utils',
				error: err,
			}, 'Adding member to MailChimp failed, probably a bad email address: ' + member.id);
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

		const needsSync = updates.email && updates.email !== member.email ||
			updates.firstname && updates.firstname !== member.firstname ||
			updates.lastname && updates.lastname !== member.lastname;

		const oldEmail = member.email;

		member = Object.assign(member, 	updates);
		await getRepository(Member).update(member.id, updates);

		if (needsSync) {
			await MembersService.syncMemberDetails(member, oldEmail);
		}
	}

	static async updateMemberProfile(member: Member, updates: Partial<MemberProfile>): Promise<void> {
		await getRepository(MemberProfile).update(member.id, updates);
	}

	static async syncMemberDetails(member: Member, oldEmail: string): Promise<void> {
		if ( member.isActiveMember ) {
			try {
				await mailchimp.mainList.updateMemberDetails( member, oldEmail );
			} catch (err) {
				if (err.response && err.response.status === 404) {
					await MembersService.addMemberToMailingLists(member);
				} else {
					throw err;
				}
			}
		}

		// TODO: Unhook this from MembersService
		const gcData = await getRepository(GCPaymentData).findOne({member});
		if ( gcData && gcData.customerId) {
			await gocardless.customers.update( gcData.customerId, {
				email: member.email,
				given_name: member.firstname,
				family_name: member.lastname
			} );
		}
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
	}
}

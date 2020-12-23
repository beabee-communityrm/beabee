import { log } from '@core/logging';
import { Members } from  '@core/database';
import mailchimp from '@core/mailchimp';

import { Member, PartialMember } from '@models/members';
import gocardless from '@core/gocardless';

export default class MembersService {
	static generateMemberCode(member: Pick<Member,'firstname'|'lastname'>): string {
		const no = ('000' + Math.floor(Math.random() * 1000)).slice(-3);
		return (member.firstname[0] + member.lastname[0] + no).toUpperCase();
	}

	static async createMember(memberObj: PartialMember): Promise<Member> {
		try {
			return await Members.create({
				...memberObj,
				referralCode: MembersService.generateMemberCode(memberObj),
				pollsCode: MembersService.generateMemberCode(memberObj)
			});
		} catch (saveError) {
			const {code, message} = saveError;
			if (code === 11000 && (message.indexOf('referralCode') > -1 || message.indexOf('pollsCode') > -1)) {
				// Retry with a different referral code
				return await MembersService.createMember(memberObj);
			}
			throw saveError;
		}
	}

	static async addMemberToMailingLists(member: Member): Promise<void> {
		try {
			await mailchimp.mainList.addMember(member);
		} catch (err) {
			log.error({
				app: 'join-utils',
				error: err,
			}, 'Adding member to MailChimp failed, probably a bad email address: ' + member.uuid);
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
		await member.save();

		if (needsSync) {
			await MembersService.syncMemberDetails(member, oldEmail);
		}
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

		if ( member.gocardless.customer_id ) {
			await gocardless.customers.update( member.gocardless.customer_id, {
				email: member.email,
				given_name: member.firstname,
				family_name: member.lastname
			} );
		}
	}
}

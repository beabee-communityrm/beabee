import { log } from '@core/logging';
import { Members } from  '@core/database';
import mailchimp from '@core/mailchimp';

import { Member, PartialMember } from '@models/members';

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
}

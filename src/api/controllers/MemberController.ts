import { CurrentUser, Get, JsonController } from 'routing-controllers';
import { getRepository } from 'typeorm';

import Member from '@models/Member';
import MemberProfile from '@models/MemberProfile';

@JsonController('/member')
export class MemberController {
	@Get('/me')
	async getMe(@CurrentUser({required: true}) member: Member): Promise<Member> {
		const profile = await getRepository(MemberProfile).findOne({member});
		if (profile) {
			member.profile = profile;
		}
		return member;
	}
}

import Member from '@models/Member';
import { CurrentUser, Get, JsonController } from 'routing-controllers';

@JsonController('/member')
export class MemberController {
	@Get('/me')
	me(@CurrentUser({required: true}) member: Member): Member {
		return member;
	}
}

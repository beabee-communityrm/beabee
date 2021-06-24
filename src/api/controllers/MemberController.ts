import Member from '@models/Member';
import { CurrentUser, Get, JsonController } from 'routing-controllers';

@JsonController('/member')
export class MemberController {
	@Get('/me')
	me(@CurrentUser() member: Member): Member {
		return member;
	}
}

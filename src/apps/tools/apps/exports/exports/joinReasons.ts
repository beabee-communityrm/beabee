import { Members } from '@core/database';
import { Member } from '@models/members';
import { ExportType } from './type';

async function getQuery() {
	return {
		join_reason: {$exists: true, $ne: null}
	};
}

async function getExport(members: Member[]) {
	return members
		.map(member => ({
			Shareable: member.join_shareable ? 'Yes' : 'No',
			Joined: member.joined,
			FirstName: member.firstname,
			Reason: member.join_reason,
			FirstHeard: member.join_how
		}));
}

export default {
	name: 'Join reasons export',
	statuses: ['added', 'seen'],
	collection: Members,
	itemName: 'join reasons',
	getQuery,
	getExport
} as ExportType<Member>;

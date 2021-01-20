import { Members, Permissions, PollAnswers, Polls } from '@core/database';
import config from  '@config';
import { Param } from '@core/utils/params';
import Export from '@models/Export';
import { Member } from '@models/members';
import { ExportType } from './type';

async function getParams(): Promise<Param[]> {
	return [
		{
			name: 'pollId',
			label: 'Poll',
			type: 'select',
			values: (await Polls.find()).map(poll => [poll._id.toString(), (poll as any).question])
		}, {
			name: 'baseURL',
			label: 'Base URL',
			type: 'text'
		}
	];
}

async function getQuery({params}: Export) {
	const poll = await Polls.findById(params?.pollId);
	const pollAnswers = await PollAnswers.find({poll});
	const memberIds = pollAnswers.map(pollAnswer => (pollAnswer as any).member);

	const permission = await Permissions.findOne( { slug: config.permission.member });

	return {
		_id: {$not: {$in: memberIds}},
		delivery_optin: true,
		'delivery_address.line1': {$exists: true},
		permissions: {$elemMatch: {
			permission,
			date_expires: {$gte: new Date()}
		}}
	};
}

async function getExport(members: Member[], {params: {baseURL} = {}}: Export) {
	return members.map(member => {
		const addressFields = Object.assign(
			{},
			...(['line1', 'line2', 'city', 'postcode'] as const)
				.map(field => member.delivery_address[field])
				.filter(line => !!line)
				.map((field, i) => ({['Address' + (i + 1)]: field}))
		);

		return {
			'First name': member.firstname,
			Surname: member.lastname,
			'Full name': member.fullname,
			'Custom 1': baseURL + '/' + member.pollsCode,
			'Custom 2': member.uuid,
			...addressFields
		};
	});
}

export default {
	name: 'Poll letter export',
	statuses: ['added', 'seen'],
	collection: Members,
	itemName: 'members',
	getParams,
	getQuery,
	getExport
} as ExportType<Member>;

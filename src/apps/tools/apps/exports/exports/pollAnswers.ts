import flat from 'flat';

import { PollAnswers, Polls } from '@core/database';
import { Param } from '@core/utils/params';
import Export from '@models/Export';
import { ExportType } from './type';

async function getParams(): Promise<Param[]> {
	return [
		{
			name: 'pollId',
			label: 'Poll',
			type: 'select',
			values: (await Polls.find()).map(poll => [poll._id.toString(), (poll as any).question])
		}
	];
}

async function getQuery({params: {pollId} = {}}: Export) {
	return {poll: pollId};
}

async function getExport(pollAnswers: any[]) {
	await PollAnswers.populate(pollAnswers, {path: 'member'});

	return pollAnswers.map(pollAnswer => {
		const member = pollAnswer.member || {};

		return {
			'First name': member.firstname,
			Surname: member.lastname,
			'Full name': member.fullname,
			'Email address': member.email,
			'Date': pollAnswer.createdAt,
			...flat(pollAnswer.answers)
		};
	});
}

export default {
	name: 'Poll answers export',
	statuses: ['added', 'seen'],
	collection: PollAnswers,
	itemName: 'poll answers',
	getParams,
	getQuery,
	getExport
} as ExportType<any>;

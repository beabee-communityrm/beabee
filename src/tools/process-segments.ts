import 'module-alias/register';

import { ConnectionOptions, getRepository, In } from 'typeorm';

import * as db from '@core/database';
import { log as mainLogger } from '@core/logging';
import { parseRuleGroup } from '@core/utils/rules';

import EmailService from '@core/services/EmailService';
import { EmailRecipient } from '@core/services/email';

import { Member } from '@models/members';
import Segment from '@models/Segment';
import SegmentOngoingEmail from '@models/SegmentOngoingEmail';
import SegmentMember from '@models/SegmentMember';

import config from '@config';

const log = mainLogger.child({app: 'process-segments'});

function membersToRecipients(members: Member[]): EmailRecipient[] {
	return members.map(member => ({
		to: {name: member.fullname, email: member.email},
		mergeFields: {
			FNAME: member.firstname
		}
	}));
}

async function processSegment(segment: Segment) {
	log.info({
		action: 'process-segment',
		data: {segmentName: segment.name}
	});

	const members = await db.Members.find(parseRuleGroup(segment.ruleGroup));
	const memberIds = members.map(m => m.id);
	const segmentMembers = await getRepository(SegmentMember).find({where: {segment}});
	const segmentMemberIds = segmentMembers.map(sm => sm.memberId);

	const newMembers = members.filter(m => segmentMemberIds.indexOf(m.id) === -1);
	const oldSegmentMemberIds = segmentMembers.filter(sm => memberIds.indexOf(sm.memberId) === -1).map(sm => sm.memberId);

	log.info({
		action: 'segment-membership',
		data: {
			existingMembers: segmentMembers.length,
			newMembers: newMembers.length,
			oldMembers: oldSegmentMemberIds.length
		}
	});

	await getRepository(SegmentMember).delete({
		segment, memberId: In(oldSegmentMemberIds)
	});
	await getRepository(SegmentMember).insert(newMembers.map(m => ({
		segment: segment,
		memberId: m.id
	})));

	const outgoingEmails = await getRepository(SegmentOngoingEmail).find({where: {segment}});

	// Only fetch old members if we need to
	const oldMembers = outgoingEmails.some(oe => oe.trigger === 'onLeave') ?
		await db.Members.find({_id: {$in: oldSegmentMemberIds}}) : [];

	for (const outgoingEmail of outgoingEmails) {
		const emailMembers = outgoingEmail.trigger === 'onLeave' ? oldMembers :
			outgoingEmail.trigger === 'onJoin' ? newMembers : [];
		if (emailMembers.length > 0) {
			await EmailService.sendRawTemplate(
				outgoingEmail.emailTemplateId,
				membersToRecipients(emailMembers)
			);
		}
	}
}

async function main(segmentId?: string) {
	let segments: Segment[];
	if (segmentId) {
		const segment = await getRepository(Segment).findOne(segmentId);
		if (segment) {
			segments = [segment];
		} else {
			log.info({
				action: 'segment-not-found',
				data: {segmentId}
			});
			return;
		}
	} else {
		segments = await getRepository(Segment).find();
	}

	for (const segment of segments) {
		await processSegment(segment);
	}
}


db.connect(config.mongo, config.db as ConnectionOptions).then(async () => {
	try {
		await main(process.argv[2]);
	} catch (error) {
		log.error({action: 'main-error', error});
	}
	await db.close();
});

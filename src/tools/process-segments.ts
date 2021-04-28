import 'module-alias/register';

import { getRepository, In } from 'typeorm';

import * as db from '@core/database';
import { log as mainLogger } from '@core/logging';
import buildQuery from '@core/utils/rules';

import EmailService from '@core/services/EmailService';
import { EmailRecipient } from '@core/providers/email';

import Member from '@models/Member';
import Segment from '@models/Segment';
import SegmentOngoingEmail from '@models/SegmentOngoingEmail';
import SegmentMember from '@models/SegmentMember';
import NewsletterService from '@core/services/NewsletterService';

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

	const matchedMembers = await buildQuery(segment.ruleGroup).getMany();

	const segmentMembers = await getRepository(SegmentMember).find({
		where: {segment}, loadRelationIds: true
	}) as unknown as WithRelationIds<SegmentMember, 'member'>[];

	const newMembers = matchedMembers.filter(m => segmentMembers.every(sm => sm.member !== m.id));
	const oldSegmentMembers = segmentMembers.filter(sm => matchedMembers.every(m => m.id !== sm.member));

	log.info({
		action: 'segment-membership',
		data: {
			existingMembers: segmentMembers.length,
			newMembers: newMembers.length,
			oldMembers: oldSegmentMembers.length
		}
	});

	await getRepository(SegmentMember).delete({
		segment, member: In(oldSegmentMembers.map(sm => sm.member as unknown as Member)) // Types seem strange here
	});
	await getRepository(SegmentMember).insert(newMembers.map(member => ({
		segment, member
	})));

	const outgoingEmails = await getRepository(SegmentOngoingEmail).find({where: {segment}});

	// Only fetch old members if we need to
	const oldMembers = segment.newsletterTag || outgoingEmails.some(oe => oe.trigger === 'onLeave') ?
		await getRepository(Member).findByIds(oldSegmentMembers.map(sm => sm.member)) : [];

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

	if (segment.newsletterTag) {
		await NewsletterService.addTagToMembers(newMembers, segment.newsletterTag);
		await NewsletterService.removeTagFromMembers(oldMembers, segment.newsletterTag);
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


db.connect().then(async () => {
	try {
		await main(process.argv[2]);
	} catch (error) {
		log.error({action: 'main-error', error});
	}
	await db.close();
});

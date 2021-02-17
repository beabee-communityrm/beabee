import 'module-alias/register';

import { ConnectionOptions, getRepository } from 'typeorm';

import * as db from '@core/database';
import { log as mainLogger } from '@core/logging';
import { parseRuleGroup } from '@core/utils/rules';

import Segment from '@models/Segment';
import SegmentMember from '@models/SegmentMember';

import config from '@config';

const log = mainLogger.child({app: 'process-segments'});

async function processSegment(segment: Segment) {
	const members = await db.Members.find(parseRuleGroup(segment.ruleGroup));
	const segmentMembers = await getRepository(SegmentMember).find({where: {segment}});
}

async function main() {
	const segments = await getRepository(Segment).find();
	for (const segment of segments) {
		await processSegment(segment);
	}
}


db.connect(config.mongo, config.db as ConnectionOptions).then(async () => {
	try {
		await main();
	} catch (error) {
		log.error({action: 'main-error', error});
	}
	await db.close();
});

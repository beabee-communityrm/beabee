import { getRepository } from 'typeorm';

import Segment from '@models/Segment';

import buildQuery, { RuleGroup } from '@core/utils/rules';

export default class SegmentService {
	static async createSegment(name: string, ruleGroup: RuleGroup): Promise<Segment> {
		const segment = new Segment();
		segment.name = name;
		segment.ruleGroup = ruleGroup;
		return await getRepository(Segment).save(segment);
	}

	static async getSegmentsWithCount(): Promise<Segment[]> {
		const segments = await getRepository(Segment).find({order: {order: 'ASC'}});
		for (const segment of segments) {
			segment.memberCount = await buildQuery(segment.ruleGroup).getCount();
		}
		return segments;
	}

	static async updateSegment(segmentId: string, updates: Partial<Segment>): Promise<void> {
		await getRepository(Segment).update(segmentId, updates);
	}
}

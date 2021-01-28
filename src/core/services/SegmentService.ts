import { RuleGroup } from '@core/utils/rules';
import Segment from '@models/Segment';
import { getRepository } from 'typeorm';

export default class SegmentService {
	static async createSegment(name: string, ruleGroup: RuleGroup): Promise<Segment> {
		const segment = new Segment();
		segment.name = name;
		segment.ruleGroup = ruleGroup;
		return await getRepository(Segment).save(segment);
	}
}

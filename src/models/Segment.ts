import { RuleGroup } from '@core/utils/rules';
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import type SegmentMember from './SegmentMember';

@Entity()
export default class Segment {
	@PrimaryGeneratedColumn('uuid')
	id!: string

	@Column()
	name!: string

	@Column({default: ''})
	description!: string

	@Column({type: 'jsonb'})
	ruleGroup!: RuleGroup

	@OneToMany('SegmentMember', 'segment')
	members!: SegmentMember[]

	@Column({type: 'int', default: 0})
	order!: number

	memberCount?: number
}

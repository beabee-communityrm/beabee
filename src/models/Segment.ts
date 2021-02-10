import { RuleGroup } from '@core/utils/rules';
import { Column, Entity, PrimaryGeneratedColumn } from 'typeorm';

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
}

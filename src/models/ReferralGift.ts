import { Column, Entity, PrimaryColumn, ValueTransformer } from 'typeorm';

interface ReferralGiftOptions {
	name: string,
	values: string[]
}

const stockTransformer: ValueTransformer = {
	to(value: Map<string, number>): [string, number][] {
		return [...value];
	},
	from(value: [string, number][]): Map<string, number> {
		return new Map(value);
	}
};

@Entity()
export default class ReferralGift {
	@PrimaryColumn()
	name!: string

	@Column()
	label!: string

	@Column()
	description!: string

	@Column()
	minAmount!: number

	@Column({default: false})
	enabled!: boolean

	@Column({type: 'jsonb', default: '[]'})
	options!: ReferralGiftOptions[]

	@Column({type: 'jsonb', default: '{}', transformer: stockTransformer})
	stock!: Map<string, number>
}

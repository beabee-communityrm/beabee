import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

import type Member from './Member';
import type Poll from './Poll';

export type PollResponseAnswers = Record<string, string|boolean|number>

@Entity()
export default class PollResponse {
	@PrimaryGeneratedColumn('uuid')
	id!: string

	@ManyToOne('Poll', 'responses')
	poll!: Poll

	@ManyToOne('Member', {nullable: true})
	member?: Member

	@Column({nullable: true})
	guestName?: string

	@Column({nullable: true})
	guestEmail?: string

	@Column({type: 'jsonb'})
	answers!: PollResponseAnswers

	@Column()
	isPartial!: boolean

	@CreateDateColumn()
	createdAt!: Date

	@UpdateDateColumn()
	updatedAt!: Date
}

import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import Poll from './Poll';

export type PollResponseAnswers = Record<string, unknown>

@Entity()
export default class PollResponse {
	@PrimaryGeneratedColumn('uuid')
	id!: string

	@ManyToOne(() => Poll)
	poll!: Poll

	@Column({nullable: true})
	memberId?: string

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

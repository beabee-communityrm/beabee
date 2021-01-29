import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import Poll from './Poll';

@Entity()
export default class PollResponse {
	@PrimaryGeneratedColumn('uuid')
	id!: string

	@ManyToOne(() => Poll)
	poll!: Poll

	@Column({nullable: true})
	memberId?: string

	@Column({type: 'jsonb'})
	answers!: Record<string, unknown>

	@Column()
	isPartial!: boolean

	@CreateDateColumn()
	createdAt!: Date

	@UpdateDateColumn()
	updatedAt!: Date
}

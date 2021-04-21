import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';

import { EmailTemplate } from '@core/providers/email';

import Segment from './Segment';

@Entity()
export default class SegmentOngoingEmail {
	@PrimaryGeneratedColumn('uuid')
	id!: string

	@CreateDateColumn()
	date!: Date

	@ManyToOne(() => Segment)
	segment!: Segment

	@Column()
	trigger!: string

	@Column()
	emailTemplateId!: string

	@Column({default: false})
	enabled!: boolean

	emailTemplate?: EmailTemplate;

	// TODO: To match with polls, sync all these fields
	get active(): boolean {
		return this.enabled;
	}
	get closed(): boolean {
		return !this.enabled;
	}
}

import moment from 'moment';
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity()
export default class Notice {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	@CreateDateColumn()
	createdAt!: Date;

	@UpdateDateColumn()
	updatedAt!: Date;

	@Column()
	name!: string;

	@Column({nullable: true})
	expires?: Date;

	@Column()
	enabled!: boolean;

	@Column()
	text!: string;

	@Column({nullable: true})
	url?: string;

	get active(): boolean {
		return this.enabled && (!this.expires || moment.utc(this.expires).isAfter());
	}

	// TODO: To match with polls, sync all these fields
	get closed(): boolean {
		return !this.enabled;
	}
}

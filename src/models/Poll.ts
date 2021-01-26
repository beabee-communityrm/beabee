import moment from 'moment';
import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

export type PollTemplate = 'custom'|'builder'|'ballot';

@Entity()
export default class Poll {
	@PrimaryColumn()
	slug!: string

	@CreateDateColumn()
	date!: Date

	@Column()
	template!: PollTemplate

	@Column({type: 'jsonb', default: '{}'})
	templateSchema!: Record<string, unknown>

	@Column()
	question!: string

	@Column({nullable: true})
	mcMergeField?: string

	@Column({nullable: true})
	pollMergeField?: string

	@Column({default: true})
	closed!: boolean

	@Column({nullable: true})
	starts?: Date

	@Column({nullable: true})
	expires?: Date

	@Column()
	allowUpdate!: boolean

	get active(): boolean {
		const now = moment.utc();
		return !this.closed && (!this.starts || now.isAfter(this.starts)) &&
			(!this.expires || now.isBefore(this.expires));
	}
}

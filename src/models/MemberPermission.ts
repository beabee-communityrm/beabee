import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity()
export default class MemberPermission {
	@PrimaryColumn()
	memberId!: string

	@PrimaryColumn()
	permission!: string

	@CreateDateColumn()
	dateAdded!: Date

	@Column({nullable: true})
	dateExpires?: Date
}

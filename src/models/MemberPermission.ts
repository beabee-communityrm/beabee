import { Column, CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';

@Entity()
export default class MemberPermission {
	@PrimaryColumn()
	memberId!: string

	@PrimaryColumn()
	permission!: 'access'|'member'|'admin'|'superadmin';

	@CreateDateColumn()
	dateAdded!: Date

	@Column({nullable: true})
	dateExpires?: Date
}

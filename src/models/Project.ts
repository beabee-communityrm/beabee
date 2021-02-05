import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity()
export default class Project {
	@PrimaryGeneratedColumn('uuid')
	id!: string

	@CreateDateColumn()
	date!: Date

	@Column()
	ownerId!: string

	@Column()
	title!: string

	@Column()
	description!: string

	@Column()
	status!: string
}

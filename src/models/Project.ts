import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import ProjectMember from './ProjectMember';

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

	@Column()
	groupName?: string

	@OneToMany(() => ProjectMember, pm => pm.project)
	members!: ProjectMember[]

	memberCount?: number
}

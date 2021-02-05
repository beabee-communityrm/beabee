import { Column, Entity, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import Project from './Project';

@Entity()
@Unique(['project', 'memberId'])
export default class ProjectMember {
	@PrimaryGeneratedColumn('uuid')
	id!: string

	@ManyToOne(() => Project)
	project!: Project

	@Column()
	memberId!: string

	@Column({nullable: true})
	tag?: string
}

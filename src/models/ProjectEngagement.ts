import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import Project from './Project';

@Entity()
export default class ProjectEngagement {
	@PrimaryGeneratedColumn('uuid')
	id!: string

	@ManyToOne(() => Project)
	project!: Project

	@Column()
  byMemberId!: string

  @Column()
  toMemberId!: string
  
  @CreateDateColumn()
  date!: Date

  @Column()
  type!: string

  @Column({nullable: true})
  notes?: string
}

import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import Project from './Project';

@Entity()
export default class ProjectEngagement {
	@PrimaryGeneratedColumn('uuid')
	id!: string

	@ManyToOne(() => Project)
	project!: Project

	@Column()
  member1Id!: string

  @Column()
  member2Id!: string
  
  @CreateDateColumn()
  date!: Date

  @Column()
  type!: string

  @Column({nullable: true})
  notes?: string
}

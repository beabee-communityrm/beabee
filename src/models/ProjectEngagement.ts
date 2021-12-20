import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn
} from "typeorm";

import type Member from "./Member";
import type Project from "./Project";

@Entity()
export default class ProjectEngagement {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne("Project")
  project!: Project;

  @ManyToOne("Member")
  byMember!: Member;

  @ManyToOne("Member")
  toMember!: Member;

  @CreateDateColumn()
  date!: Date;

  @Column()
  type!: string;

  @Column({ nullable: true })
  notes: string | undefined;
}

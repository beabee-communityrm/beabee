import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn
} from "typeorm";

import type Member from "./Member";
import type ProjectMember from "./ProjectMember";

@Entity()
export default class Project {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @CreateDateColumn()
  date!: Date;

  @ManyToOne("Member")
  owner!: Member;

  @Column()
  title!: string;

  @Column()
  description!: string;

  @Column()
  status!: string;

  @Column({ nullable: true })
  groupName?: string;

  @OneToMany("ProjectMember", "project")
  members!: ProjectMember[];

  memberCount?: number;
}

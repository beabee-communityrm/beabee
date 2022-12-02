import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn
} from "typeorm";

import type Contact from "./Contact";
import type ProjectContact from "./ProjectContact";

@Entity()
export default class Project {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @CreateDateColumn()
  date!: Date;

  @ManyToOne("Contact")
  owner!: Contact;

  @Column()
  title!: string;

  @Column()
  description!: string;

  @Column()
  status!: string;

  @Column({ type: String, nullable: true })
  groupName!: string | null;

  @OneToMany("ProjectContact", "project")
  members!: ProjectContact[];

  memberCount?: number;
}

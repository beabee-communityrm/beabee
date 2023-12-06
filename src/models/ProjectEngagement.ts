import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn
} from "typeorm";

import type Contact from "./Contact";
import type Project from "./Project";

@Entity()
export default class ProjectEngagement {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  projectId!: string;
  @ManyToOne("Project")
  project!: Project;

  @ManyToOne("Contact")
  byContact!: Contact;

  @ManyToOne("Contact")
  toContact!: Contact;

  @CreateDateColumn()
  date!: Date;

  @Column()
  type!: string;

  @Column({ type: String, nullable: true })
  notes!: string | null;
}

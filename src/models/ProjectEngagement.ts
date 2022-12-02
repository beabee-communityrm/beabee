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

  @ManyToOne("Project")
  project!: Project;

  @ManyToOne("Contact")
  byMember!: Contact;

  @ManyToOne("Contact")
  toMember!: Contact;

  @CreateDateColumn()
  date!: Date;

  @Column()
  type!: string;

  @Column({ type: String, nullable: true })
  notes!: string | null;
}

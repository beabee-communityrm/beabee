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

  @Column({ type: String, nullable: true })
  ownerId!: string | null;
  @ManyToOne("Contact", { nullable: true })
  owner!: Contact | null;

  @Column()
  title!: string;

  @Column()
  description!: string;

  @Column()
  status!: string;

  @Column({ type: String, nullable: true })
  groupName!: string | null;

  @OneToMany("ProjectContact", "project")
  contacts!: ProjectContact[];

  contactCount?: number;
}

import {
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique
} from "typeorm";
import type Contact from "./Contact";
import type Project from "./Project";

@Entity()
@Unique(["project", "contact"])
export default class ProjectContact {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  projectId!: string;
  @ManyToOne("Project", "contacts")
  project!: Project;

  @Column()
  contactId!: string;
  @ManyToOne("Contact")
  contact!: Contact;

  @Column({ type: String, nullable: true })
  tag!: string | null;
}

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
@Unique(["project", "member"])
export default class ProjectContact {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne("Project", "members")
  project!: Project;

  @ManyToOne("Contact")
  member!: Contact;

  @Column({ type: String, nullable: true })
  tag!: string | null;
}

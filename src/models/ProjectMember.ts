import {
  Column,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique
} from "typeorm";
import type Member from "./Member";
import type Project from "./Project";

@Entity()
@Unique(["project", "member"])
export default class ProjectMember {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne("Project", "members")
  project!: Project;

  @ManyToOne("Member")
  member!: Member;

  @Column({ type: String, nullable: true })
  tag!: string | null;
}

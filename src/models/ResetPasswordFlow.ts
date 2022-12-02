import {
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn
} from "typeorm";
import type Contact from "./Contact";

@Entity()
export default class ResetPasswordFlow {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne("Contact")
  member!: Contact;

  @CreateDateColumn()
  date!: Date;
}

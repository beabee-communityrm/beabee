import {
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  Column
} from "typeorm";
import Contact from "./Contact";
import { RESET_SECURITY_FLOW_TYPE } from "@enums/reset-security-flow-type";

@Entity()
export default class ResetSecurityFlow {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  contactId!: string;
  @ManyToOne("Contact")
  contact!: Contact;

  @CreateDateColumn()
  date!: Date;

  @Column({ type: String })
  type!: RESET_SECURITY_FLOW_TYPE;
}

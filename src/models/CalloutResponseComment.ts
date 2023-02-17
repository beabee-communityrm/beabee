import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn
} from "typeorm";
import CalloutResponse from "./CalloutResponse";
import Contact from "./Contact";

@Entity()
export default class CalloutReponseComment {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne("Contact")
  contact!: Contact;

  @ManyToOne("CalloutResponse")
  calloutResponse!: CalloutResponse;

  @CreateDateColumn()
  createdAt!: Date;

  @Column({ type: String })
  text!: String;
}

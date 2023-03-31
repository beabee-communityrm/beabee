import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from "typeorm";
import CalloutResponse from "./CalloutResponse";
import Contact from "./Contact";

@Entity()
export default class CalloutResponseComment {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne((type) => Contact)
  @JoinColumn()
  contact!: Contact;

  @Column()
  contactId!: string;

  @ManyToOne((type) => CalloutResponse)
  @JoinColumn()
  response!: CalloutResponse;

  @Column()
  responseId!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column({ type: String })
  text!: string;
}

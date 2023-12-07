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

  @Column()
  contactId!: string;
  @ManyToOne((type) => Contact)
  @JoinColumn()
  contact!: Contact;

  @Column()
  responseId!: string;
  @ManyToOne((type) => CalloutResponse)
  @JoinColumn()
  response!: CalloutResponse;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column({ type: String })
  text!: string;
}

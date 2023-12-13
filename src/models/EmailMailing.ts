import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn
} from "typeorm";
import type Email from "@models/Email";

export type EmailMailingRecipient = Record<string, string>;

@Entity()
export default class EmailMailing {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  emailId!: string;
  @ManyToOne("Email", "mailings")
  email!: Email;

  @CreateDateColumn()
  createdDate!: Date;

  @Column({ type: Date, nullable: true })
  sentDate!: Date | null;

  @Column({ type: "jsonb" })
  recipients!: EmailMailingRecipient[];

  @Column({ type: String, nullable: true })
  emailField!: string | null;

  @Column({ type: String, nullable: true })
  nameField!: string | null;

  @Column({ type: "json", nullable: true })
  mergeFields!: Record<string, string> | null;
}

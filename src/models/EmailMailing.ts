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

  @ManyToOne("Email", "mailings")
  email!: Email;

  @CreateDateColumn()
  createdDate!: Date;

  @Column({ nullable: true })
  sentDate: Date | undefined;

  @Column({ type: "jsonb" })
  recipients!: EmailMailingRecipient[];

  @Column({ nullable: true })
  emailField: string | undefined;

  @Column({ nullable: true })
  nameField: string | undefined;

  @Column({ type: "json", nullable: true })
  mergeFields: Record<string, string> | undefined;
}

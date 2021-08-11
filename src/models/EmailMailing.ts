import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn
} from "typeorm";
import Email from "@models/Email";

export type EmailMailingRecipient = Record<string, string>;

@Entity()
export default class EmailMailing {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne(() => Email)
  email!: Email;

  @CreateDateColumn()
  createdDate!: Date;

  @Column({ nullable: true })
  sentDate?: Date;

  @Column({ type: "jsonb" })
  recipients!: EmailMailingRecipient[];

  @Column({ nullable: true })
  emailField?: string;

  @Column({ nullable: true })
  nameField?: string;

  @Column({ type: "json", nullable: true })
  mergeFields?: Record<string, string>;
}

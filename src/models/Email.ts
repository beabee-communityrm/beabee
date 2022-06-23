import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn
} from "typeorm";
import type EmailMailing from "./EmailMailing";

@Entity()
export default class Email {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @CreateDateColumn()
  date!: Date;

  @Column()
  name!: string;

  @Column({ type: String, nullable: true })
  fromName!: string | null;

  @Column({ type: String, nullable: true })
  fromEmail!: string | null;

  @Column()
  subject!: string;

  @Column({ type: "text" })
  body!: string;

  @OneToMany("EmailMailing", "email")
  mailings!: EmailMailing[];

  mailingCount?: number;
}

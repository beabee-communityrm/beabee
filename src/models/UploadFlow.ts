import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn
} from "typeorm";
import type Contact from "./Contact";

@Entity()
export default class UploadFlow {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ type: String, nullable: true })
  contactId!: string | null;
  @ManyToOne("Contact", { nullable: true })
  contact!: Contact | null;

  @CreateDateColumn()
  date!: Date;

  @Column()
  ipAddress!: string;

  @Column()
  used!: boolean;
}

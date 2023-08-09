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

  @ManyToOne("Contact", { nullable: true })
  contact!: Contact | null;

  @CreateDateColumn()
  date!: Date;

  @Column()
  ipAddress!: string;
}

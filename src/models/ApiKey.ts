import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn
} from "typeorm";
import type Contact from "./Contact";

@Entity()
export default class ApiKey {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne("Contact")
  creator!: Contact;

  @CreateDateColumn()
  createdAt!: Date;

  @Column()
  secretHash!: string;

  @Column({ type: String, nullable: true })
  description!: string | null;
}

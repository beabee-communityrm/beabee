import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryColumn
} from "typeorm";
import type Contact from "./Contact";

@Entity()
export default class ApiKey {
  @PrimaryColumn()
  id!: string;

  @ManyToOne("Contact")
  creator!: Contact;

  @CreateDateColumn()
  createdAt!: Date;

  @Column()
  secretHash!: string;

  @Column()
  description!: string;
}

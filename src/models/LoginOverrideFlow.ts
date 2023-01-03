import { differenceInHours } from "date-fns";
import {
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn
} from "typeorm";
import type Contact from "./Contact";

@Entity()
export default class LoginOverrideFlow {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne("Contact")
  contact!: Contact;

  @CreateDateColumn()
  date!: Date;

  get isValid(): boolean {
    return differenceInHours(new Date(), this.date) < 12;
  }
}

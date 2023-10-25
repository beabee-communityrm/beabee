import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn
} from "typeorm";
import { ContactMfaType } from "../api/data/ContactData/interface";

import type Contact from "./Contact";

/**
 * The **unsecure** contact multi factor authentication information with the `secret` key
 **/
@Entity()
export class ContactMfa {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @OneToOne("Contact", "mfa")
  @JoinColumn()
  contact!: Contact;

  @Column({
    type: "enum",
    enum: ContactMfaType
  })
  type!: ContactMfaType;

  @Column({ default: "" })
  secret!: string;
}

/**
 * The **secure** contact multi factor authentication information without the `secret` key
 */
export type ContactMfaSecure = Pick<ContactMfa, "id" | "type">;

export default ContactMfa;

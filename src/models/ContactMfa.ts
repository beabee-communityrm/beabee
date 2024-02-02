import {
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn
} from "typeorm";

import { CONTACT_MFA_TYPE } from "@enums/contact-mfa-type";

import type Contact from "./Contact";

/**
 * The **unsecure** contact multi factor authentication information with the `secret` key
 **/
@Entity()
export default class ContactMfa {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @OneToOne("Contact", "mfa")
  @JoinColumn()
  contact!: Contact;

  @Column({ type: String })
  type!: CONTACT_MFA_TYPE;

  @Column({ default: "" })
  secret!: string;
}

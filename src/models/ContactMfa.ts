import { Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { ContactMfaType } from "../api/data/ContactData/interface";

import type Contact from "./Contact";

/** Contact multi factor authentication information */
@Entity()
export default class ContactMfa {

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

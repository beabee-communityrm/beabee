import { Column, Entity, JoinColumn, OneToOne } from "typeorm";
import { ContactMfaType } from '../api/data/ContactData/interface';

import type Contact from "./Contact";

/** Contact multi factor authentication information */
@Entity()
export default class ContactMfa {
  @OneToOne("Contact", "mfa", { primary: true })
  @JoinColumn()
  contact!: Contact;

  @Column({
    type: "enum",
    enum: ContactMfaType,
  })
  type!: ContactMfaType;

  @Column({ default: "" })
  secret!: string;
}

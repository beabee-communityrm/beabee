import { NewsletterStatus } from "@beabee/beabee-common";
import { Column, Entity, JoinColumn, OneToMany, OneToOne } from "typeorm";

import type Address from "./Address";
import type Contact from "./Contact";
import type ContactProfileTag from "./ContactProfileTag";

@Entity()
export default class ContactProfile {
  @OneToOne("Contact", "profile", { primary: true })
  @JoinColumn()
  contact!: Contact;

  @Column({ default: "" })
  description!: string;

  @Column({ type: "text", default: "" })
  bio!: string;

  @Column({ type: "text", default: "" })
  notes!: string;

  @Column({ default: "" })
  telephone!: string;

  @Column({ default: "" })
  twitter!: string;

  @Column({ default: "" })
  preferredContact!: string;

  @Column({ default: false })
  deliveryOptIn!: boolean;

  @Column({ type: "jsonb", nullable: true })
  deliveryAddress!: Address | null;

  @OneToMany("ContactProfileTag", "profile", { eager: true, cascade: true })
  tags!: ContactProfileTag[];

  @Column({ default: NewsletterStatus.None })
  newsletterStatus!: NewsletterStatus;

  @Column({ type: "jsonb", default: "[]" })
  newsletterGroups!: string[];
}

import { Column, Entity, JoinColumn, OneToOne } from "typeorm";

import { NewsletterStatus } from "@core/providers/newsletter";

import type Address from "./Address";
import type Member from "./Member";

@Entity()
export default class MemberProfile {
  @OneToOne("Member", "profile", { primary: true })
  @JoinColumn()
  member!: Member;

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
  deliveryAddress?: Address;

  @Column({ type: "jsonb", default: "[]" })
  tags!: string[];

  @Column({ default: NewsletterStatus.Unsubscribed })
  newsletterStatus!: NewsletterStatus;

  @Column({ type: "jsonb", default: "[]" })
  newsletterGroups!: string[];
}

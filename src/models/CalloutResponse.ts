import { CalloutResponseAnswers } from "@beabee/beabee-common";
import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn
} from "typeorm";

import type Contact from "./Contact";
import type Callout from "./Callout";
import type CalloutResponseTag from "./CalloutResponseTag";
import type CalloutResponseComment from "./CalloutResponseComment";

@Entity()
@Unique(["callout", "number"])
export default class CalloutResponse {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  calloutSlug!: string;
  @ManyToOne("Callout", "responses")
  callout!: Callout;

  @Column()
  number!: number;

  @Column({ type: String, nullable: true })
  contactId!: string | null;
  @ManyToOne("Contact", { nullable: true })
  contact!: Contact | null;

  @Column({ type: String, nullable: true })
  guestName!: string | null;

  @Column({ type: String, nullable: true })
  guestEmail!: string | null;

  @Column({ type: "jsonb" })
  answers!: CalloutResponseAnswers;

  @Column()
  isPartial!: boolean;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column({ default: "" })
  bucket!: string;

  @OneToMany("CalloutResponseTag", "response")
  tags!: CalloutResponseTag[];

  @ManyToOne("Contact", { nullable: true })
  assignee!: Contact | null;

  latestComment?: CalloutResponseComment | null;
}

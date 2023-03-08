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
import CalloutResponseTag from "./CalloutResponseTag";

export type CalloutResponseAnswer =
  | string
  | boolean
  | number
  | null
  | undefined
  | Record<string, boolean>;
export type CalloutResponseAnswers = Record<string, CalloutResponseAnswer>;

@Entity()
@Unique(["callout", "number"])
export default class CalloutResponse {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne("Callout", "responses")
  callout!: Callout;

  @Column()
  number!: number;

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

  @Column({ type: String, nullable: true })
  bucket!: string | null;

  @OneToMany("CalloutResponseTag", "response")
  tags!: CalloutResponseTag[];
}

import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn
} from "typeorm";

import type Contact from "./Contact";
import type Callout from "./Callout";

export type CalloutResponseAnswer =
  | string
  | boolean
  | number
  | null
  | undefined
  | Record<string, boolean>;
export type CalloutResponseAnswers = Record<string, CalloutResponseAnswer>;

@Entity()
export default class CalloutResponse {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne("Callout", "responses")
  poll!: Callout;

  @ManyToOne("Contact", { nullable: true })
  member!: Contact | null;

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
}

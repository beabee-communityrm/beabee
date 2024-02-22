import { CalloutFormSchema } from "@beabee/beabee-common";
import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn
} from "typeorm";

import { CalloutAccess } from "@enums/callout-access";

import ItemWithStatus from "./ItemWithStatus";
import type CalloutResponse from "./CalloutResponse";
import type CalloutVariant from "./CalloutVariant";

import { CalloutResponseViewSchema } from "@type/callout-response-view-schema";

@Entity()
export default class Callout extends ItemWithStatus {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column({ unique: true })
  slug!: string;

  @CreateDateColumn()
  date!: Date;

  @Column()
  image!: string;

  @Column({ type: "jsonb" })
  formSchema!: CalloutFormSchema;

  @Column({ type: "jsonb", nullable: true })
  responseViewSchema!: CalloutResponseViewSchema | null;

  @Column({ type: String, nullable: true })
  mcMergeField!: string | null;

  @Column({ type: String, nullable: true })
  pollMergeField!: string | null;

  @Column()
  allowUpdate!: boolean;

  @Column({ default: false })
  allowMultiple!: boolean;

  @Column({ default: CalloutAccess.Member })
  access!: CalloutAccess;

  @Column({ default: false })
  hidden!: boolean;

  @OneToMany("CalloutResponse", "callout")
  responses!: CalloutResponse[];

  @Column({ nullable: true })
  responsePassword?: string;

  @OneToMany("CalloutVariant", "callout")
  variants!: CalloutVariant[];

  hasAnswered?: boolean;
  responseCount?: number;
}

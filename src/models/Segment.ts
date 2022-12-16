import { RuleGroup } from "@beabee/beabee-common";
import { Column, Entity, OneToMany, PrimaryGeneratedColumn } from "typeorm";
import type SegmentContact from "./SegmentContact";

@Entity()
export default class Segment {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @Column()
  name!: string;

  @Column({ default: "" })
  description!: string;

  @Column({ type: "jsonb" })
  ruleGroup!: RuleGroup;

  @OneToMany("SegmentContact", "segment")
  contacts!: SegmentContact[];

  @Column({ type: "int", default: 0 })
  order!: number;

  @Column({ type: String, nullable: true })
  newsletterTag!: string | null;

  contactCount?: number;
}

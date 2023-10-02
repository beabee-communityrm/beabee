import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn
} from "typeorm";
import type Contact from "./Contact";
import { RoleType } from "@beabee/beabee-common";

export enum ActivityType {
  AddRole = "addRole",
  RevokeRole = "revokeRole",
  ChangeContribution = "changeContribution",
  CancelContribution = "cancelContribution"
}

interface ChangeContributionData {
  oldMonthlyAmount: number;
  newMonthlyAmount: number;
  startNow: boolean;
}

interface RoleData {
  type: RoleType;
}

type ActivityData = ChangeContributionData | RoleData | {};

@Entity()
export default class ContactActivity {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @ManyToOne("Contact")
  contact!: Contact;

  @CreateDateColumn()
  date!: Date;

  @Column()
  type!: ActivityType;

  @Column({ type: "jsonb", default: "{}" })
  data!: ActivityData;
}

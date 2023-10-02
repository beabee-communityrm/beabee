import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn
} from "typeorm";
import type Contact from "./Contact";

export enum ActivityType {
  ChangeContribution = "changeContribution",
  CancelContribution = "cancelContribution"
}

interface IncreaseContributionData {
  oldMonthlyAmount: number;
  newMonthlyAmount: number;
  startNow: boolean;
}

type ActivityData = IncreaseContributionData | {};

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

import { ContributionPeriod, PaymentMethod } from "@beabee/beabee-common";
import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn
} from "typeorm";

import { getActualAmount } from "@core/utils";

import type Contact from "./Contact";

import config from "@config";

@Entity()
@Unique(["contactId", "status"])
export default class ContactContribution {
  @PrimaryGeneratedColumn("uuid")
  id!: string;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  @Column()
  contactId!: string;
  @ManyToOne("Contact", "contribution")
  contact!: Contact;

  @Column({ type: String, nullable: true })
  status!: "pending" | "current" | null;

  @Column()
  method!: PaymentMethod;

  @Column({ type: String, nullable: true })
  customerId!: string | null;

  @Column({ type: String, nullable: true })
  mandateId!: string | null;

  @Column({ type: String, nullable: true })
  subscriptionId!: string | null;

  @Column({ type: Number, nullable: true })
  monthlyAmount!: number | null;

  @Column({ type: String, nullable: true })
  period!: ContributionPeriod | null;

  @Column({ type: Boolean, nullable: true })
  payFee!: boolean | null;

  @Column({ type: Date, nullable: true })
  cancelledAt!: Date | null;

  get amount(): number | null {
    return this.monthlyAmount === null || this.period === null
      ? null
      : getActualAmount(this.monthlyAmount, this.period);
  }

  get description(): string {
    /*if (this.contributionType === "Gift") {
      return "Gift";
    } else */ if (
      this.method === null ||
      this.period === null ||
      this.amount === null
    ) {
      return "None";
    } else {
      return `${config.currencySymbol}${this.amount}/${
        this.period === "monthly" ? "month" : "year"
      }`;
    }
  }

  // static get none(): Omit<ContactContribution, "contact" | "contactId"> {
  //   return {
  //     method: null,
  //     monthlyAmount: null,
  //     amount: null,
  //     customerId: null,
  //     mandateId: null,
  //     subscriptionId: null,
  //     payFee: null,
  //     nextAmount: null,
  //     cancelledAt: null,

  //     period: null, // TODO
  //     description: "None"
  //   };
  // }
}

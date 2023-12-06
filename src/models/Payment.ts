import { PaymentStatus } from "@beabee/beabee-common";
import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn
} from "typeorm";
import type Contact from "./Contact";

@Entity()
export default class Payment {
  @PrimaryColumn()
  id!: string;

  @Column({ type: String, nullable: true })
  subscriptionId!: string | null;

  @Column({ type: String, nullable: true })
  contactId!: string | null;
  @ManyToOne("Contact", { nullable: true })
  contact!: Contact | null;

  @Column()
  status!: PaymentStatus;

  @Column()
  description!: string;

  @Column({ type: "real" })
  amount!: number;

  @Column({ type: "real", nullable: true })
  amountRefunded!: number | null;

  @Column({ type: "date" })
  chargeDate!: Date;

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;

  get isPending(): boolean {
    return this.status === PaymentStatus.Pending;
  }
  get isSuccessful(): boolean {
    return this.status === PaymentStatus.Successful;
  }
}

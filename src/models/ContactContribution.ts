import { PaymentMethod } from "@beabee/beabee-common";
import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from "typeorm";

import type Contact from "./Contact";

@Entity()
export default class ContactContribution {
  @PrimaryColumn()
  contactId!: string;
  @OneToOne("Contact", "contribution")
  @JoinColumn()
  contact!: Contact;

  @Column({ type: String, nullable: true })
  method!: PaymentMethod | null;

  @Column({ type: String, nullable: true })
  customerId!: string | null;

  @Column({ type: String, nullable: true })
  mandateId!: string | null;

  @Column({ type: String, nullable: true })
  subscriptionId!: string | null;

  @Column({ type: Boolean, nullable: true })
  payFee!: boolean | null;

  @Column({ type: "jsonb", nullable: true })
  nextAmount!: { chargeable: number; monthly: number } | null;

  @Column({ type: Date, nullable: true })
  cancelledAt!: Date | null;
}

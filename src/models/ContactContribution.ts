import { PaymentMethod } from "@beabee/beabee-common";
import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from "typeorm";

import type Contact from "./Contact";

export interface GCPaymentData {
  customerId: string | null;
  mandateId: string | null;
  subscriptionId: string | null;
  payFee: boolean | null;
  nextAmount: {
    chargeable: number;
    monthly: number;
  } | null;
}

export interface ManualPaymentData {
  source: string;
  reference: string;
}

export interface StripePaymentData {
  customerId: string | null;
  mandateId: string | null;
  subscriptionId: string | null;
  payFee: boolean | null;
  nextAmount: {
    chargeable: number;
    monthly: number;
  } | null;
}

export type PaymentProviderData =
  | GCPaymentData
  | ManualPaymentData
  | StripePaymentData
  | {};

@Entity()
export default class ContactContribution {
  @PrimaryColumn()
  contactId!: string;
  @OneToOne("Contact", "contribution")
  @JoinColumn()
  contact!: Contact;

  @Column({ type: String, nullable: true })
  method!: PaymentMethod | null;

  @Column({ type: Date, nullable: true })
  cancelledAt!: Date | null;

  @Column({ type: "jsonb", default: "{}" })
  data!: PaymentProviderData;
}

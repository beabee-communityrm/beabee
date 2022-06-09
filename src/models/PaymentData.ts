import { Column, Entity, JoinColumn, OneToOne } from "typeorm";

import { PaymentMethod } from "@core/utils";

import type Member from "@models/Member";

export interface GCPaymentData {
  customerId: string | null;
  mandateId: string | null;
  subscriptionId: string | null;
  cancelledAt: Date | null;
  payFee: boolean | null;
  nextMonthlyAmount: number | null;
}

export interface ManualPaymentData {
  source: string;
  reference: string;
}

export interface StripePaymentData {
  customerId: string | null;
  mandateId: string | null;
  subscriptionId: string | null;
  cancelledAt: Date | null;
  payFee: boolean | null;
  nextMonthlyAmount: number | null;
}

export type PaymentProviderData =
  | GCPaymentData
  | ManualPaymentData
  | StripePaymentData;

@Entity()
export default class PaymentData {
  @OneToOne("Member", "profile", { primary: true })
  @JoinColumn()
  member!: Member;

  @Column({ type: String, nullable: true })
  method!: PaymentMethod | null;

  @Column({ type: "jsonb", default: "{}" })
  data!: PaymentProviderData;
}

import { PaymentMethod } from "@core/utils";
import { Column, ManyToOne } from "typeorm";
import type Member from "./Member";

export interface GCPaymentData {
  customerId: string;
  mandateId: string;
  subscriptionId: string;
  cancelledAt: Date | null;
  payFee: boolean | null;
}

export interface ManualPaymentData {
  source: string;
  reference: string;
}

export interface StripePaymentData {
  customerId: string;
}

export default class PaymentData {
  @ManyToOne("Member", { primary: true })
  member!: Member;

  @Column({ nullable: true })
  method!: PaymentMethod | null;

  @Column({ type: "jsonb", default: "{}" })
  data!: GCPaymentData | ManualPaymentData | StripePaymentData;
}

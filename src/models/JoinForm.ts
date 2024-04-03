import { ContributionPeriod, PaymentMethod } from "@beabee/beabee-common";
import { Column } from "typeorm";

import { PaymentForm } from "@core/utils";
import Password from "./Password";

import { Address } from "@type/address";

export interface ReferralGiftForm {
  referralGift?: string | null;
  referralGiftOptions?: Record<string, string> | null;
}

export default class JoinForm implements PaymentForm, ReferralGiftForm {
  @Column()
  email!: string;

  @Column(() => Password)
  password!: Password;

  @Column({ type: "real" })
  monthlyAmount!: number;

  @Column()
  period!: ContributionPeriod;

  @Column()
  payFee!: boolean;

  @Column({ default: false })
  prorate!: boolean;

  @Column()
  paymentMethod!: PaymentMethod;

  @Column({ type: String, nullable: true })
  firstname?: string | null;

  @Column({ type: String, nullable: true })
  lastname?: string | null;

  @Column({ type: "jsonb", nullable: true })
  billingAddress?: Address | null;

  @Column({ nullable: true })
  vatNumber?: string | null;

  @Column({ type: String, nullable: true })
  referralCode?: string | null;

  @Column({ type: String, nullable: true })
  referralGift?: string | null;

  @Column({ type: "jsonb", nullable: true })
  referralGiftOptions?: Record<string, string> | null;
}

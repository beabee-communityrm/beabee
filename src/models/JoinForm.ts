import { Column } from "typeorm";
import {
  ContributionPeriod,
  ReferralGiftForm,
  PaymentForm,
  PaymentMethod
} from "@core/utils";
import Password from "./Password";

export default class JoinForm
  implements PaymentForm, Partial<ReferralGiftForm>
{
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

  @Column({ nullable: true })
  referralCode?: string;

  @Column({ nullable: true })
  referralGift?: string;

  @Column({ type: "jsonb", nullable: true })
  referralGiftOptions?: Record<string, string>;
}

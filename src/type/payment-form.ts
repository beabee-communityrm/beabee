import { ContributionPeriod } from "@beabee/beabee-common";

export interface PaymentForm {
  monthlyAmount: number;
  period: ContributionPeriod;
  payFee: boolean;
  prorate: boolean;
}

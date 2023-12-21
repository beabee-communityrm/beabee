import { ContributionPeriod, ContributionType } from "@beabee/beabee-common";
import { PaymentSource } from "@core/utils";

export interface ContributionInfo {
  type: ContributionType;
  amount?: number;
  nextAmount?: number;
  period?: ContributionPeriod;
  cancellationDate?: Date;
  renewalDate?: Date;
  paymentSource?: PaymentSource;
  payFee?: boolean;
  hasPendingPayment?: boolean;
  membershipStatus: "active" | "expiring" | "expired" | "none";
  membershipExpiryDate?: Date;
}

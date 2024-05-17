import {
  ContributionPeriod,
  MembershipStatus,
  PaymentMethod,
  PaymentSource
} from "@beabee/beabee-common";

export interface ContributionInfo {
  method: PaymentMethod;
  amount?: number;
  nextAmount?: number;
  period?: ContributionPeriod;
  cancellationDate?: Date;
  renewalDate?: Date;
  paymentSource?: PaymentSource;
  payFee?: boolean;
  hasPendingPayment?: boolean;
  membershipStatus: MembershipStatus;
  membershipExpiryDate?: Date;
}

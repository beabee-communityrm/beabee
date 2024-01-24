import {
  ContributionPeriod,
  ContributionType,
  MembershipStatus
} from "@beabee/beabee-common";

import { PaymentSource } from "./payment-source";

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
  membershipStatus: MembershipStatus;
  membershipExpiryDate?: Date;
}

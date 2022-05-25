import { getRepository } from "typeorm";

import { ContributionInfo, PaymentForm } from "@core/utils";

import { CompletedPaymentFlow } from "@core/providers/payment-flow";

import Member from "@models/Member";
import Payment from "@models/Payment";
import PaymentData, { PaymentProviderData } from "@models/PaymentData";

export interface UpdateContributionResult {
  startNow: boolean;
  expiryDate: Date;
}

export abstract class PaymentProvider<T extends PaymentProviderData> {
  protected readonly data: T;
  protected readonly member: Member;

  constructor(data: PaymentData) {
    this.data = data.data as T;
    this.member = data.member;
  }

  protected async updateData() {
    await getRepository(PaymentData).update(this.member.id, {
      data: this.data
    });
  }

  abstract canChangeContribution(useExistingMandate: boolean): Promise<boolean>;

  abstract cancelContribution(keepMandate: boolean): Promise<void>;

  abstract getContributionInfo(): Promise<
    Partial<ContributionInfo> | undefined
  >;

  abstract updateMember(updates: Partial<Member>): Promise<void>;

  abstract updateContribution(
    paymentForm: PaymentForm
  ): Promise<UpdateContributionResult>;

  abstract updatePaymentSource(
    completedPaymentFlow: CompletedPaymentFlow
  ): Promise<void>;

  abstract permanentlyDeleteMember(): Promise<void>;
}

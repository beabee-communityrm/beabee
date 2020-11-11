import { Customer } from 'gocardless-nodejs/types/Types';
import { Document } from 'mongoose';

import { ContributionPeriod, Member } from '@models/members';

interface RawJoinForm {
    amount: string,
    amountOther: string,
    period: ContributionPeriod,
    referralCode: string,
    referralGift: string,
    referralGiftOptions: Record<string, unknown>,
    payFee: boolean
}

export interface JoinForm {
    amount: number,
    period: ContributionPeriod,
    referralCode: string,
    referralGift: string,
    referralGiftOptions: Record<string, unknown>,
    payFee: boolean
}

export interface CompletedJoinFlow {
    customer: Customer,
    mandateId: string,
    joinForm: JoinForm
}

interface JoinFlow extends Document {
    date: Date,
    redirect_flow_id: string,
    sessionToken: string,
    joinForm: JoinForm
}

export interface RestartFlow extends Document {
	code: string,
	member: Member,
	date: Date,
	customerId: string,
	mandateId: string
	joinForm: JoinForm
}

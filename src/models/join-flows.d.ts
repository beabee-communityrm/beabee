import { Customer } from 'gocardless-nodejs/types/Types';
import { Document, Model } from 'mongoose';
import { ContributionPeriod } from '@core/utils';

interface RawJoinForm {
    amount: string,
    amountOther: string,
    period: ContributionPeriod,
    referralCode: string,
    referralGift: string,
    referralGiftOptions: Record<string, unknown>,
    payFee: boolean
}

interface JoinForm {
    amount: number,
    period: ContributionPeriod,
    referralCode: string,
    referralGift: string,
    referralGiftOptions: Record<string, unknown>,
    payFee: boolean
}

interface CompletedJoinFlow {
    customer: Customer,
    mandateId: string,
    joinForm: JoinForm
}

interface JoinFlow extends Document {
    date?: Date,
    redirect_flow_id: string,
    sessionToken: string,
    joinForm: JoinForm
}

export const model: Model<JoinFlow>;

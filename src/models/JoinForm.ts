import { Column } from 'typeorm';
import { ContributionPeriod, ReferralGiftForm, PaymentForm } from '@core/utils';
import Password from './Password';

export default class JoinForm implements PaymentForm, Partial<ReferralGiftForm> {
    @Column({nullable: true})
    email!: string;

    @Column(() => Password)
    password!: Password;

    @Column()
    amount!: number;

    @Column()
    period!: ContributionPeriod;

    @Column()
    payFee!: boolean;

    @Column({ default: false })
    prorate!: boolean;

    @Column({ nullable: true })
    referralCode?: string;

    @Column({ nullable: true })
    referralGift?: string;

    @Column({ type: 'jsonb', nullable: true })
    referralGiftOptions?: Record<string, string>;
}

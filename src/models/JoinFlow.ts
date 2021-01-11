import { ContributionPeriod, ReferralGiftForm, PaymentForm } from '@core/utils';
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export class JoinForm implements PaymentForm, Partial<ReferralGiftForm> {
    @Column()
    amount!: number;

    @Column()
    period!: ContributionPeriod;

    @Column()
    payFee!: boolean;

    @Column({default: false})
    prorate!: boolean;

    @Column({nullable: true})
    referralCode?: string;

    @Column({nullable: true})
    referralGift?: string;

    @Column({type: 'jsonb', nullable: true})
    referralGiftOptions?:  Record<string, string>;
}

@Entity()
export default class JoinFlow {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @CreateDateColumn()
    date!: Date;

    @Column()
    redirectFlowId!: string;

    @Column()
    sessionToken!: string;

    @Column(() => JoinForm)
    joinForm!: JoinForm;
}

import { ContributionPeriod } from '@core/utils';
import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

export class JoinForm {
    @Column()
    amount: number;

    @Column()
    period: ContributionPeriod;

    @Column()
    payFee: boolean;

    @Column({default: false})
    prorate: boolean;

    @Column({nullable: true})
    referralCode?: string;

    @Column({nullable: true})
    referralGift?: string;

    @Column({type: 'jsonb', nullable: true})
    referralGiftOptions?:  Record<string, unknown>;
}

@Entity()
export default class JoinFlow {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @CreateDateColumn()
    date: Date;

    @Column()
    redirectFlowId: string;

    @Column()
    sessionToken: string;

    @Column(type => JoinForm)
    joinForm: JoinForm;
}

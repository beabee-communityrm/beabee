import { Column, CreateDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import ReferralGift from './ReferralGift';

@Entity()
export default class Referral {
	@PrimaryGeneratedColumn('uuid')
	id!: string

	@CreateDateColumn()
	date!: Date

	@Column({nullable: true})
	referrerId?: string 

	@Column()
	refereeId!: string

	@Column()
	refereeAmount!: number

	@ManyToOne(() => ReferralGift, {nullable: true})
	refereeGift?: ReferralGift

	@Column({type: 'jsonb', nullable: true})
	refereeGiftOptions?: Record<string, string>

	@ManyToOne(() => ReferralGift, {nullable: true})
	referrerGift?: ReferralGift

	@Column({type: 'jsonb', nullable: true})
	referrerGiftOptions?: Record<string, string>

	@Column({default: false})
	referrerHasSelected!: boolean
}

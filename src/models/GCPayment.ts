import { Column, Entity } from 'typeorm';
import { ContributionPeriod } from '@core/utils';
import Payment from './Payment';

@Entity()
export default class GCPayment extends Payment {
	static readonly pendingStatuses = [
		'pending_customer_approval',
		'pending_submission',
		'submitted'
	];

	static readonly successStatuses = [
		'confirmed',
		'paid_out'
	];

	@Column({unique: true})
	paymentId!: string

	@Column({nullable: true})
	subscriptionId?: string

	@Column({nullable: true})
	subscriptionPeriod?: ContributionPeriod

	@Column()
	status!: string

	get isPending(): boolean {
		return GCPayment.pendingStatuses.indexOf(this.status) > -1;
	}

	get isSuccessful(): boolean {
		return GCPayment.successStatuses.indexOf(this.status) > -1;
	}
}

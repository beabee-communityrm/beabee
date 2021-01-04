import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { ContributionPeriod } from '@core/utils';

@Entity()
export default class Payment {
	static readonly pendingStatuses = [
		'pending_customer_approval',
		'pending_submission',
		'submitted'
	];

	static readonly successStatuses = [
		'confirmed',
		'paid_out'
	];

	@PrimaryGeneratedColumn('uuid')
	id!: string

	@Column({unique: true})
	paymentId!: string

	@Column({nullable: true})
	subscriptionId?: string

	@Column({nullable: true})
	subscriptionPeriod?: ContributionPeriod

	@Column({nullable: true})
	memberId?: string

	@Column()
	status!: string

	@Column()
	description!: string

	@Column({type: 'real'})
	amount!: number

	@Column({type: 'real', nullable: true})
	amountRefunded!: number

	@Column({type: 'date'})
	chargeDate!: Date

	@CreateDateColumn()
	createdAt!: Date

	@UpdateDateColumn()
	updatedAt!: Date

	get isPending(): boolean {
		return Payment.pendingStatuses.indexOf(this.status) > -1;
	}

	get isSuccessful(): boolean {
		return Payment.successStatuses.indexOf(this.status) > -1;
	}
}

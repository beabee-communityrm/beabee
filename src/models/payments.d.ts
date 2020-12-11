import { Document, Model } from 'mongoose';
import { ContributionPeriod } from '@core/utils';
import { Member } from '@models/members';

interface Payment extends Document {
	payment_id: string,
	subscription_id?: string,
	subscription_period?: ContributionPeriod,
	member: Member,
	status: string,
	description: string,
	amount: number,
	amount_refunded: number,
	created: Date,
	change_date: Date,
	updated: Date,

	readonly isPending: boolean
}

export const model: Model<Payment>;

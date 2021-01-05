import { Document, Model } from 'mongoose';
import { ContributionPeriod } from '@core/utils';

interface PartialMember {
	email: string,
	firstname: string,
	lastname: string,
	delivery_optin: boolean,
	delivery_address: {
		line1?: string,
		line2?: string,
		city?: string,
		postcode?: string
	}
}
interface Member extends PartialMember, Document {
	uuid?: string
	referralCode: string,
	pollsCode: string
	giftCode?: string,
	gocardless: {
		customer_id?: string,
		mandate_id?: string,
		subscription_id?: string,
		paying_fee?: boolean,
		amount?: number,
		period?: ContributionPeriod
		next_amount?: number
		cancelled_at?: Date
	},
	memberPermission: {
		date_added: Date,
		date_expires: Date
	},
	otp: {
		key?: string,
		activated?: boolean
	},
	loginOverride: {
		code?: string,
		expires?: Date
	},
	password: {
		hash: string,
		salt: string,
		iterations: number,
		reset_code?: string,
		tries: number
	},
	readonly isActiveMember: boolean,
	readonly hasActiveSubscription: boolean,
	readonly canTakePayment: boolean,
	readonly contributionPeriod: ContributionPeriod
	readonly contributionMonthlyAmount: number
	readonly fullname: string
	readonly setupComplete: boolean
}

export const model: Model<Member>;

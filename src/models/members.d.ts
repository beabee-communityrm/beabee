import { Document, Model } from 'mongoose';
import { ContributionPeriod } from '@core/utils';

interface PartialMember {
	email: string,
	firstname: string,
	lastname: string,
	delivery_optin: boolean,
	delivery_address: {
		line1: string,
		line2: string,
		city: string,
		postcode: string
	},
	gocardless: {
		customer_id: string,
		mandate_id: string,
	}
}
interface Member extends PartialMember, Document {
	uuid?: string
	referralCode: string,
	pollsCode: string
	gocardless: {
		customer_id: string,
		mandate_id: string,
		subscription_id?: string,
		period?: ContributionPeriod,
		amount?: number,
		paying_fee?: boolean
	},
	memberPermission?: {
		date_added: Date,
		date_expires: Date
	},
	otp?: {
		key: string,
		activated: boolean
	},
	loginOverride?: {
		code: string,
		expires: Date
	},
	password?: {
		hash: string,
		salt: string,
		iterations: number,
		reset_code: string,
		tries: number
	},
	readonly isActiveMember: boolean
	readonly hasActiveSubscription: boolean,
}

export const model: Model<Member>;

import { Document } from 'mongoose';

export enum ContributionPeriod {
	Monthly = 'monthly',
	Annually = 'annually',
	Gift = 'gift'
}

export interface PartialMember {
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
export interface Member extends PartialMember, Document {
	_id: string,
	uuid: string
	isActiveMember: boolean
	hasActiveSubscription: boolean,
	gocardless: {
		customer_id: string,
		mandate_id: string,
		subscription_id?: string,
		period?: ContributionPeriod,
		amount?: number,
		paying_fee?: boolean
	},
	memberPermission: {
		date_added: Date,
		date_expires: Date
	}
}

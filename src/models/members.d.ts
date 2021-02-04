import { Document, Model } from 'mongoose';
import { ContributionPeriod, ContributionType } from '@core/utils';

interface Permission {
	permission?: string
	date_added: Date
	date_expires?: Date
	remove?(): void
}

interface MemberPermission extends Permission {
	date_expires: Date
}

interface Permissions extends Array<Permission> {
	id(s: string): Permission
}

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
	contributionType: ContributionType
}

interface Member extends PartialMember, Document {
	uuid: string
	referralCode: string,
	pollsCode: string
	giftCode?: string,
	contributionMonthlyAmount?: number
	nextContributionMonthlyAmount?: number
	contributionPeriod?: ContributionPeriod
	permissions: Permissions,
	memberPermission: MemberPermission,
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
		tries?: number
	},
	delivery_copies?: number,
	join_shareable?: boolean,
	joined?: Date,
	join_reason?: string,
	join_how?: string,
	tags: {
		name: string
	}[]
	description?: string
	bio?: string
	readonly isActiveMember: boolean,
	readonly contributionDescription: string
	readonly fullname: string
	readonly setupComplete: boolean
	readonly referralLink: string
	readonly memberMonthsRemaining: number
}

export const model: Model<Member>;

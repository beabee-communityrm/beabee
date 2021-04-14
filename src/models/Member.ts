import moment from 'moment';
import { Column, CreateDateColumn, Entity, OneToMany, OneToOne, PrimaryGeneratedColumn } from 'typeorm';

import { ContributionPeriod, ContributionType, getActualAmount } from '@core/utils';
import config from '@config';

import type MemberPermission from './MemberPermission';
import type { PermissionType } from './MemberPermission';
import type MemberProfile from './MemberProfile';

interface LoginOverride {
	code: string
	expires: Date
}

export class Password {
	@Column()
	hash!: string

	@Column()
	salt!: string

	@Column({default: 1000})
	iterations!: number

	@Column({default: 0})
	tries!: number

	@Column({nullable: true})
	resetCode?: string
}

class OneTimePassword {
	@Column({nullable: true})
	key?: string

	@Column({default: false})
	activated!: boolean
}

@Entity()
export default class Member {
	@PrimaryGeneratedColumn('uuid')
	id!: string

	@Column({unique: true})
	email!: string

	@Column()
	firstname!: string

	@Column()
	lastname!: string

	@Column(() => Password)
	password!: Password

	@Column(() => OneTimePassword)
	otp!: OneTimePassword

	@CreateDateColumn()
	joined!: Date

	@Column({nullable: true})
	lastSeen?: Date

	@Column({type: 'jsonb', nullable: true})
	loginOverride?: LoginOverride

	@Column()
	contributionType!: ContributionType;

	@Column({nullable: true})
	contributionPeriod?: ContributionPeriod

	@Column({type: 'real', nullable: true})
	contributionMonthlyAmount?: number

	@Column({type: 'real', nullable: true})
	nextContributionMonthlyAmount?: number

	@Column({unique: true})
	referralCode!: string

	@Column({unique: true})
	pollsCode!: string

	@OneToMany('MemberPermission', 'member', {eager: true, cascade: true})
	permissions!: MemberPermission[]

	@OneToOne('MemberProfile', 'member')
	profile?: MemberProfile

	get quickPermissions(): PermissionType[] {
		return this.permissions.filter(p => p.isActive).map(p => p.permission);
	}

	get fullname(): string {
		return this.firstname + ' ' + this.lastname;
	}

	get contributionDescription(): string {
		if (this.contributionType === 'Gift') {
			return 'Gift';
		} else if (this.contributionType === 'None' || !this.contributionPeriod || !this.contributionMonthlyAmount) {
			return 'None';
		} else {
			const amount = getActualAmount(this.contributionMonthlyAmount, this.contributionPeriod);
			return `${config.currencySymbol}${amount}/${this.contributionPeriod === 'monthly' ? 'month' : 'year'}`;
		}
	}

	get isActiveMember(): boolean {
		return this.permissions.some(p => p.permission === 'member' && p.isActive);
	}

	get memberMonthsRemaining(): number {
		const membership = this.permissions.find(p => p.permission === 'member');
		return membership ? Math.max(0,
			moment.utc(membership.dateExpires)
				.subtract(config.gracePeriod).diff(moment.utc(), 'months')) : 0;
	}

	get membershipExpires(): Date|undefined {
		const membership = this.permissions.find(p => p.permission === 'member');
		return membership?.dateExpires;
	}

	get setupComplete(): boolean {
		return this.password.hash !== '';
	}
}

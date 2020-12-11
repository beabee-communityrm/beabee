import moment from 'moment';
import { Customer, CustomerBankAccount, CustomerCurrency, PaymentCurrency, SubscriptionIntervalUnit } from 'gocardless-nodejs/types/Types';

import { Payments } from '@core/database';
import gocardless from '@core/gocardless';
import { log } from '@core/logging';
import { getChargeableAmount, cleanEmailAddress, ContributionPeriod } from  '@core/utils';

import MembersService from '@core/services/MembersService';

import config from '@config';

import { JoinForm } from '@models/JoinFlow';
import { Member, PartialMember } from '@models/members';

export default class PaymentService {
	static async customerToMember(customerId: string, overrides?: Partial<Customer>): Promise<PartialMember|null> {
		const customer = {
			...await gocardless.customers.get(customerId),
			...overrides
		};

		return customer.given_name === '' || customer.family_name === '' ? null : {
			firstname: customer.given_name,
			lastname: customer.family_name,
			email: cleanEmailAddress(customer.email),
			delivery_optin: false,
			delivery_address: {
				line1: customer.address_line1,
				line2: customer.address_line2,
				city: customer.city,
				postcode: customer.postal_code
			}
		};
	}

	static getMonthsLeftOnContribution(user: Member): number {
		return Math.max(0,
			moment.utc(user.memberPermission.date_expires)
				.subtract(config.gracePeriod).diff(moment.utc(), 'months')
		);
	}

	static async getBankAccount(member: Member): Promise<CustomerBankAccount|null> {
		if (member.gocardless.mandate_id) {
			try {
				const mandate = await gocardless.mandates.get(member.gocardless.mandate_id);
				return await gocardless.customerBankAccounts.get(mandate.links.customer_bank_account);
			} catch (err) {
				// 404s can happen on dev as we don't use real mandate IDs
				if (config.dev && err.response && err.response.status === 404) {
					return null;
				}
				throw err;
			}
		} else {
			return null;
		}
	}

	static async canChangeContribution(user: Member, useExistingMandate: boolean): Promise<boolean> {
		// No payment method available
		if (useExistingMandate && !user.canTakePayment) {
			return false;
		}

		// Can always change contribution if there is no subscription
		if (!user.hasActiveSubscription) {
			return true;
		}

		// Monthly contributors can update their contribution even if they have
		// pending payments, but they can't always change their mandate as this can
		// result in double charging
		if (useExistingMandate && user.contributionPeriod === 'monthly') {
			return true;
		} else {
			const payments = await Payments.find({member: user}, ['status', 'charge_date'], {
				limit: 1,
				sort: {charge_date: -1}
			});

			// Should always be at least 1 payment, but maybe the webhook is slow?
			return payments.length > 0 && !payments[0].isPending;
		}
	}

	static async updateContribution(user: Member, joinForm: JoinForm): Promise<void> {
		if (!user.canTakePayment) {
			throw new Error('User does not have active payment method');
		}

		let startNow = true;

		if (user.isActiveMember) {
			if (user.hasActiveSubscription) {
				await PaymentService.updateSubscription(user, joinForm);
			} else {
				const startDate = moment.utc(user.memberPermission.date_expires).subtract(config.gracePeriod).toDate();
				await PaymentService.createSubscription(user, joinForm, startDate);
			}

			startNow = await PaymentService.prorateSubscription(user, joinForm);
		} else {
			if (user.hasActiveSubscription) {
				await PaymentService.cancelContribution(user);
			}

			await PaymentService.createSubscription(user, joinForm);
			await MembersService.addMemberToMailingLists(user);
		}

		await PaymentService.activateContribution(user, joinForm, startNow);
	}

	static async cancelContribution(member: Member): Promise<void> {
		await gocardless.subscriptions.cancel( member.gocardless.subscription_id );

		member.gocardless.subscription_id = undefined;
		member.gocardless.cancelled_at = new Date();
		await member.save();
	}

	private static async createSubscription(member: Member, joinForm: JoinForm,  startDate?: Date): Promise<void> {
		const subscription = await gocardless.subscriptions.create( {
			amount: getChargeableAmount(joinForm.amount, joinForm.period, joinForm.payFee).toString(),
			currency: CustomerCurrency.GBP,
			interval_unit: joinForm.period === ContributionPeriod.Annually ? SubscriptionIntervalUnit.Yearly: SubscriptionIntervalUnit.Monthly,
			name: 'Membership',
			links: {
				mandate: member.gocardless.mandate_id
			},
			...(startDate && { start_date: startDate.toString() })
		} );

		member.gocardless.subscription_id = subscription.id;
		member.gocardless.period = joinForm.period;
		member.gocardless.paying_fee = joinForm.payFee;

		await member.save();
	}

	private static async updateSubscription(user: Member, joinForm: JoinForm): Promise<void> {
		// Don't update if the amount isn't actually changing
		if (joinForm.amount === user.contributionMonthlyAmount && joinForm.payFee === user.gocardless.paying_fee) {
			return;
		}

		const chargeableAmount = getChargeableAmount(joinForm.amount, user.contributionPeriod, joinForm.payFee);

		log.info( {
			app: 'direct-debit',
			action: 'update-subscription-amount',
			data: {
				userId: user._id,
				chargeableAmount
			}
		} );

		try {
			await gocardless.subscriptions.update( user.gocardless.subscription_id, {
				amount: chargeableAmount.toString(),
				name: 'Membership' // Slowly overwrite subscription names
			} );
		} catch ( gcError ) {
			// Can't update subscription names if they are linked to a plan
			if ( gcError.response && gcError.response.status === 422 ) {
				await gocardless.subscriptions.update( user.gocardless.subscription_id, {
					amount: chargeableAmount.toString()
				} );
			} else {
				throw gcError;
			}
		}

		user.gocardless.paying_fee = joinForm.payFee;
		await user.save();
	}

	private static async prorateSubscription(member: Member, joinForm: JoinForm): Promise<boolean> {
		const monthsLeft = PaymentService.getMonthsLeftOnContribution(member);
		const prorateAmount = (joinForm.amount - member.contributionMonthlyAmount) * monthsLeft * 100;

		log.info( {
			app: 'direct-debit',
			action: 'prorate-subscription',
			data: { userId: member._id, joinForm, monthsLeft, prorateAmount }
		} );


		if (prorateAmount > 0 && joinForm.prorate) {
			await gocardless.payments.create({
				amount: prorateAmount.toString(),
				currency: PaymentCurrency.GBP,
				description: 'One-off payment to start new contribution',
				links: {
					mandate: member.gocardless.mandate_id
				}
			});
		}

		return prorateAmount === 0 || joinForm.prorate;
	}

	private static async activateContribution(member: Member, joinForm: JoinForm, startNow: boolean): Promise<void> {
		log.info( {
			app: 'direct-debit',
			action: 'activate-subscription',
			data: {
				userId: member._id,
				joinForm,
			}
		} );

		const subscription = await gocardless.subscriptions.get(member.gocardless.subscription_id);
		const nextChargeDate = moment.utc(subscription.upcoming_payments[0].charge_date).add(config.gracePeriod);
		if (member.memberPermission) {
			// If subscription will charge after current end date extend to accommodate
			if (nextChargeDate.isAfter(member.memberPermission.date_expires)) {
				member.memberPermission.date_expires = nextChargeDate.toDate();
			}
		} else {
			member.memberPermission = {
				date_added: new Date(),
				date_expires: nextChargeDate.toDate()
			};
		}

		member.gocardless.cancelled_at = undefined;

		if (startNow) {
			member.gocardless.amount = joinForm.amount;
			member.gocardless.next_amount = undefined;
		} else {
			member.gocardless.next_amount = joinForm.amount;
		}

		await member.save();
	}

	static async updatePaymentMethod(member: Member, customerId: string, mandateId: string): Promise<void> {
		if (member.gocardless.mandate_id) {
			// Remove subscription before cancelling mandate to stop the webhook triggering a cancelled email
			member.gocardless.subscription_id = undefined;
			await member.save();
			await gocardless.mandates.cancel(member.gocardless.mandate_id);
		}

		member.gocardless.customer_id = customerId;
		member.gocardless.mandate_id = mandateId;

		await member.save();
	}
}

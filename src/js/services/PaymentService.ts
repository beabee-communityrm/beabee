import moment from 'moment';
import { Customer, CustomerBankAccount, CustomerCurrency, PaymentCurrency, SubscriptionIntervalUnit } from 'gocardless-nodejs/types/Types';

import { Payments } from '@core/database';
import gocardless from '@core/gocardless';
import { log } from '@core/logging';
import { getChargeableAmount, cleanEmailAddress, ContributionPeriod, PaymentForm } from  '@core/utils';

import MembersService from '@core/services/MembersService';

import config from '@config';

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

	static async updateContribution(user: Member, paymentForm: PaymentForm): Promise<void> {
		if (!user.canTakePayment) {
			throw new Error('User does not have active payment method');
		}

		let startNow = true;

		if (user.isActiveMember) {
			if (user.hasActiveSubscription) {
				await PaymentService.updateSubscription(user, paymentForm);
			} else {
				const startDate = moment.utc(user.memberPermission.date_expires).subtract(config.gracePeriod);
				await PaymentService.createSubscription(user, paymentForm, startDate.format('YYYY-MM-DD'));
			}

			startNow = await PaymentService.prorateSubscription(user, paymentForm);
		} else {
			if (user.hasActiveSubscription) {
				await PaymentService.cancelContribution(user);
			}

			await PaymentService.createSubscription(user, paymentForm);
		}

		await PaymentService.activateContribution(user, paymentForm, startNow);
	}

	static async cancelContribution(member: Member): Promise<void> {
		await gocardless.subscriptions.cancel( member.gocardless.subscription_id );

		member.gocardless.subscription_id = undefined;
		member.gocardless.cancelled_at = new Date();
		await member.save();
	}

	private static async createSubscription(member: Member, paymentForm: PaymentForm,  startDate?: string): Promise<void> {
		log.info( {
			app: 'direct-debit',
			action: 'create-subscription',
			data: {
				userId: member._id,
				paymentForm,
				startDate
			}
		} );

		const subscription = await gocardless.subscriptions.create( {
			amount: getChargeableAmount(paymentForm.amount, paymentForm.period, paymentForm.payFee).toString(),
			currency: CustomerCurrency.GBP,
			interval_unit: paymentForm.period === ContributionPeriod.Annually ? SubscriptionIntervalUnit.Yearly: SubscriptionIntervalUnit.Monthly,
			name: 'Membership',
			links: {
				mandate: member.gocardless.mandate_id
			},
			...(startDate && { start_date: startDate })
		} );

		member.gocardless.subscription_id = subscription.id;
		member.gocardless.period = paymentForm.period;
		member.gocardless.paying_fee = paymentForm.payFee;

		await member.save();
	}

	private static async updateSubscription(user: Member, paymentForm: PaymentForm): Promise<void> {
		// Don't update if the amount isn't actually changing
		if (paymentForm.amount === user.contributionMonthlyAmount && paymentForm.payFee === user.gocardless.paying_fee) {
			return;
		}

		const chargeableAmount = getChargeableAmount(paymentForm.amount, user.contributionPeriod, paymentForm.payFee);

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

		user.gocardless.paying_fee = paymentForm.payFee;
		await user.save();
	}

	private static async prorateSubscription(member: Member, paymentForm: PaymentForm): Promise<boolean> {
		const monthsLeft = PaymentService.getMonthsLeftOnContribution(member);
		const prorateAmount = (paymentForm.amount - member.contributionMonthlyAmount) * monthsLeft * 100;

		log.info( {
			app: 'direct-debit',
			action: 'prorate-subscription',
			data: { userId: member._id, paymentForm, monthsLeft, prorateAmount }
		} );


		if (prorateAmount > 0 && paymentForm.prorate) {
			await gocardless.payments.create({
				amount: prorateAmount.toString(),
				currency: PaymentCurrency.GBP,
				description: 'One-off payment to start new contribution',
				links: {
					mandate: member.gocardless.mandate_id
				}
			});
		}

		return prorateAmount === 0 || paymentForm.prorate;
	}

	private static async activateContribution(member: Member, paymentForm: PaymentForm, startNow: boolean): Promise<void> {
		const subscription = await gocardless.subscriptions.get(member.gocardless.subscription_id);
		const futurePayments = await gocardless.payments.list({
			subscription: subscription.id,
			'charge_date[gte]': moment.utc().format('YYYY-MM-DD')
		});
		const nextChargeDate = moment.utc(
			futurePayments ?
				futurePayments.map(p => p.charge_date).sort()[0] :
				subscription.upcoming_payments[0].charge_date
		).add(config.gracePeriod);

		log.info( {
			app: 'direct-debit',
			action: 'activate-subscription',
			data: {
				userId: member._id,
				paymentForm,
				nextChargeDate
			}
		} );

		const wasInactive = !member.isActiveMember;

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
			member.gocardless.amount = paymentForm.amount;
			member.gocardless.next_amount = undefined;
		} else {
			member.gocardless.next_amount = paymentForm.amount;
		}

		await member.save();

		if (wasInactive) {
			await MembersService.addMemberToMailingLists(member);
		}
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

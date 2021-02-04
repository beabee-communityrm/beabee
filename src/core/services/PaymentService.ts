import moment from 'moment';
import { Customer, CustomerBankAccount, CustomerCurrency, PaymentCurrency, SubscriptionIntervalUnit } from 'gocardless-nodejs/types/Types';
import { getRepository } from 'typeorm';

import gocardless from '@core/gocardless';
import { log } from '@core/logging';
import { cleanEmailAddress, ContributionPeriod, getActualAmount, PaymentForm } from  '@core/utils';

import MembersService from '@core/services/MembersService';

import config from '@config';

import GCPaymentData from '@models/GCPaymentData';
import { Member, PartialMember } from '@models/members';
import Payment from '@models/Payment';

interface PayingMember extends Member {
	contributionMonthlyAmount: number
	contributionPeriod: ContributionPeriod
}

function getChargeableAmount(amount: number, period: ContributionPeriod, payFee: boolean): number {
	const actualAmount = getActualAmount(amount, period);
	return payFee ? Math.floor(actualAmount / 0.99 * 100) + 20 : actualAmount * 100;
}

// Update contribution has been split into lots of methods as it's complicated
// and has mutable state, nothing else should use the private methods in here
abstract class UpdateContributionPaymentService {
	static async updateContribution(user: Member, paymentForm: PaymentForm): Promise<void> {
		log.info( {
			app: 'direct-debit',
			action: 'update-contribution',
			data: {
				userId: user._id,
				paymentForm
			}
		} );

		let gcData = await PaymentService.getPaymentData(user);

		if (!gcData?.mandateId) {
			throw new Error('User does not have active payment method');
		}

		let startNow = true;

		if (user.isActiveMember) {
			if (gcData.subscriptionId) {
				gcData = await this.updateSubscription(user as PayingMember, gcData, paymentForm);
			} else {
				const startDate = moment.utc(user.memberPermission.date_expires).subtract(config.gracePeriod);
				gcData = await this.createSubscription(user, gcData, paymentForm, startDate.format('YYYY-MM-DD'));
			}

			startNow = await this.prorateSubscription(user as PayingMember, gcData, paymentForm);
		} else {
			if (gcData.subscriptionId) {
				await PaymentService.cancelContribution(user);
				gcData.subscriptionId = undefined;
			}

			gcData = await this.createSubscription(user, gcData, paymentForm);
		}

		gcData = await this.activateContribution(user, gcData, paymentForm, startNow);

		await getRepository(GCPaymentData).update(gcData.memberId, gcData);
	}

	private static async createSubscription(member: Member, gcData: GCPaymentData, paymentForm: PaymentForm,  startDate?: string): Promise<GCPaymentData> {
		log.info( {
			app: 'direct-debit',
			action: 'create-subscription',
			data: {
				userId: member._id,
				paymentForm,
				startDate
			}
		} );

		if (startDate) {
			const mandate = await gocardless.mandates.get(gcData.mandateId!);
			// next_possible_charge_date will always have a value as this is an active mandate
			if (startDate < mandate.next_possible_charge_date!) {
				startDate = mandate.next_possible_charge_date;
			}
		}

		const subscription = await gocardless.subscriptions.create( {
			amount: getChargeableAmount(paymentForm.amount, paymentForm.period, paymentForm.payFee).toString(),
			currency: CustomerCurrency.GBP,
			interval_unit: paymentForm.period === ContributionPeriod.Annually ? SubscriptionIntervalUnit.Yearly: SubscriptionIntervalUnit.Monthly,
			name: 'Membership',
			links: {
				mandate: gcData.mandateId
			},
			...(startDate && { start_date: startDate })
		} );

		member.contributionPeriod = paymentForm.period;
		await member.save();

		gcData.subscriptionId = subscription.id;
		gcData.payFee = paymentForm.payFee;
		return gcData;
	}

	private static async updateSubscription(user: PayingMember, gcData: GCPaymentData, paymentForm: PaymentForm): Promise<GCPaymentData> {
		// Don't update if the amount isn't actually changing
		if (paymentForm.amount === user.contributionMonthlyAmount && paymentForm.payFee === gcData.payFee) {
			return gcData;
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
			await gocardless.subscriptions.update( gcData.subscriptionId!, {
				amount: chargeableAmount.toString(),
				name: 'Membership' // Slowly overwrite subscription names
			} );
		} catch ( gcError ) {
			// Can't update subscription names if they are linked to a plan
			if ( gcError.response && gcError.response.status === 422 ) {
				await gocardless.subscriptions.update( gcData.subscriptionId!, {
					amount: chargeableAmount.toString()
				} );
			} else {
				throw gcError;
			}
		}

		gcData.payFee = paymentForm.payFee;
		return gcData;
	}

	private static async prorateSubscription(member: PayingMember, gcData: GCPaymentData, paymentForm: PaymentForm): Promise<boolean> {
		const monthsLeft = member.memberMonthsRemaining;
		const prorateAmount = (paymentForm.amount - member.contributionMonthlyAmount) * monthsLeft;

		log.info( {
			app: 'direct-debit',
			action: 'prorate-subscription',
			data: { userId: member._id, paymentForm, monthsLeft, prorateAmount }
		} );


		if (prorateAmount > 0 && paymentForm.prorate) {
			await gocardless.payments.create({
				amount: (prorateAmount * 100).toFixed(0),
				currency: PaymentCurrency.GBP,
				description: 'One-off payment to start new contribution',
				links: {
					mandate: gcData.mandateId
				}
			});
		}

		return prorateAmount === 0 || paymentForm.prorate;
	}

	private static async activateContribution(member: Member, gcData: GCPaymentData, paymentForm: PaymentForm, startNow: boolean): Promise<GCPaymentData> {
		const subscription = await gocardless.subscriptions.get(gcData.subscriptionId!);
		const futurePayments = await gocardless.payments.list({
			subscription: subscription.id,
			'charge_date[gte]': moment.utc().format('YYYY-MM-DD')
		});
		const nextChargeDate = moment.utc(
			futurePayments.length > 0 ?
				futurePayments.map(p => p.charge_date).sort()[0] :
				subscription.upcoming_payments[0].charge_date
		).add(config.gracePeriod);

		log.info( {
			app: 'direct-debit',
			action: 'activate-contribution',
			data: {
				userId: member._id,
				paymentForm,
				startNow,
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

		gcData.cancelledAt = undefined;

		if (startNow) {
			member.contributionMonthlyAmount = paymentForm.amount;
			member.nextContributionMonthlyAmount = undefined;
		} else {
			member.nextContributionMonthlyAmount = paymentForm.amount;
		}

		await member.save();

		if (wasInactive) {
			await MembersService.addMemberToMailingLists(member);
		}

		return gcData;
	}
}

export default class PaymentService extends UpdateContributionPaymentService {
	static async customerToMember(customerId: string, overrides?: Partial<Customer>): Promise<PartialMember|null> {
		const customer = {
			...await gocardless.customers.get(customerId),
			...overrides
		};

		return !customer.given_name || !customer.family_name ? null : {
			firstname: customer.given_name,
			lastname: customer.family_name,
			email: cleanEmailAddress(customer.email || ''),
			delivery_optin: false,
			delivery_address: {
				line1: customer.address_line1,
				line2: customer.address_line2,
				city: customer.city,
				postcode: customer.postal_code
			}
		};
	}

	static async getBankAccount(member: Member): Promise<CustomerBankAccount|null> {
		const gcData = await this.getPaymentData(member);
		if (gcData?.mandateId) {
			try {
				const mandate = await gocardless.mandates.get(gcData.mandateId);
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

	static async getPaymentData(member: Member): Promise<GCPaymentData|undefined> {
		return await getRepository(GCPaymentData).findOne({memberId: member.id});
	}

	static async canChangeContribution(user: Member, useExistingMandate: boolean): Promise<boolean> {
		const gcData = await this.getPaymentData(user);
		// No payment method available
		if (useExistingMandate && !gcData?.mandateId) {
			return false;
		}

		// Can always change contribution if there is no subscription
		if (!gcData?.subscriptionId) {
			return true;
		}

		// Monthly contributors can update their contribution even if they have
		// pending payments, but they can't always change their mandate as this can
		// result in double charging
		return useExistingMandate && user.contributionPeriod === 'monthly' ||
			!(await this.hasPendingPayment(user));
	}

	static async cancelContribution(member: Member): Promise<void> {
		log.info( {
			app: 'direct-debit',
			action: 'cancel-subscription',
			data: {
				userId: member._id
			}
		} );

		const gcData = await PaymentService.getPaymentData(member);
		if (gcData) {
			await getRepository(GCPaymentData).update(gcData.memberId, {
				subscriptionId: undefined,
				cancelledAt: new Date()
			});

			if (gcData.subscriptionId) {
				await gocardless.subscriptions.cancel(gcData.subscriptionId);
			}

			member.nextContributionMonthlyAmount = undefined;
			await member.save();
		}
	}

	static async updatePaymentMethod(member: Member, customerId: string, mandateId: string): Promise<void> {
		const gcData = await PaymentService.getPaymentData(member) || new GCPaymentData();

		log.info({
			app: 'direct-debit',
			action: 'update-payment-method',
			data: {
				userId: member._id,
				gcData,
				customerId,
				mandateId
			}
		});

		if (gcData.mandateId) {
			// Remove subscription before cancelling mandate to stop the webhook triggering a cancelled email
			await getRepository(GCPaymentData).update(gcData.memberId, {subscriptionId: undefined});
			await gocardless.mandates.cancel(gcData.mandateId);
		}

		// This could be creating payment data for the first time
		gcData.memberId = member.id;
		gcData.customerId = customerId;
		gcData.mandateId = mandateId;
		gcData.subscriptionId = undefined;

		await getRepository(GCPaymentData).save(gcData);
	}

	static async hasPendingPayment(member: Member): Promise<boolean> {
		const gcData = await PaymentService.getPaymentData(member);
		if (gcData && gcData.subscriptionId) {
			for (const status of Payment.pendingStatuses) {
				const payments = await gocardless.payments.list({
					limit: 1, status, subscription: gcData.subscriptionId
				});
				if (payments.length > 0) {
					return true;
				}
			}
		}

		return false;
	}

	static async getPayments(member: Member): Promise<Payment[]> {
		return await getRepository(Payment).find({
			where: {
				memberId: member.id
			},
			order: {chargeDate: 'DESC'}
		});
	}

	static async permanentlyDeleteMember(member: Member): Promise<void> {
		const gcData = await PaymentService.getPaymentData(member);
		await getRepository(Payment).delete({memberId: member.id});
		if (gcData?.mandateId) {
			await gocardless.mandates.cancel(gcData.mandateId);
		}
		if (gcData?.customerId) {
			await gocardless.customers.remove(gcData.customerId);
		}
	}
}

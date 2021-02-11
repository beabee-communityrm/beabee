import { Payment as GCPayment, Subscription, SubscriptionIntervalUnit } from 'gocardless-nodejs/types/Types';
import moment, { Moment } from 'moment';
import { getRepository } from 'typeorm';

import { Members } from '@core/database';
import gocardless from '@core/gocardless';
import { log as mainLogger } from '@core/logging';
import { ContributionPeriod } from '@core/utils';

import GCPaymentService from '@core/services/GCPaymentService';

import GCPaymentData from '@models/GCPaymentData';
import Payment from '@models/Payment';

import config from '@config';

const log = mainLogger.child({app: 'payment-webhook-service'});

export default class GCPaymentWebhookService {
	static async updatePayment(gcPaymentId: string): Promise<Payment> {
		log.info({
			action: 'update-payment',
			data: {
				paymentId: gcPaymentId
			}
		});

		const gcPayment = await gocardless.payments.get(gcPaymentId);
		let payment = await getRepository(Payment).findOne({ paymentId: gcPayment.id });
		if (!payment) {
			payment = await GCPaymentWebhookService.createPayment(gcPayment);
		}

		payment.status = gcPayment.status;
		payment.description = gcPayment.description || 'Unknown';
		payment.amount = Number(gcPayment.amount) / 100;
		payment.amountRefunded = Number(gcPayment.amount_refunded) / 100;
		payment.chargeDate = moment.utc(gcPayment.charge_date).toDate();

		await getRepository(Payment).save(payment);

		return payment;
	}

	static async confirmPayment(payment: Payment): Promise<void> {
		log.info({
			action: 'confirm-payment',
			data: {
				paymentId: payment.paymentId,
				memberId: payment.memberId,
				subscriptionId: payment.subscriptionId
			}
		});

		if (!payment.memberId || !payment.subscriptionId) {
			log.info({
				action: 'ignore-confirm-payment'
			});
			return;
		}

		const member = await Members.findById(payment.memberId);
		if (!member) {
			log.error({
				action: 'payment-member-not-found',
			}, 'Payment member not found');
			return;
		}

		const gcData = await GCPaymentService.getPaymentData(member);
		if (!gcData) {
			log.error({
				action: 'payment-gc-data-not-found'
			}, 'Member has no GC data but confirmed payments');
			return;
		}

		const nextExpiryDate = await GCPaymentWebhookService.calcPaymentExpiryDate(payment);

		log.info({
			action: 'extend-membership',
			data: {
				prevDate: member.memberPermission.date_expires,
				newDate: nextExpiryDate
			}
		});

		if (member.nextContributionMonthlyAmount) {
			const newAmount = GCPaymentWebhookService.getSubscriptionAmount(payment, !!gcData.payFee);
			if (newAmount === member.nextContributionMonthlyAmount) {
				member.contributionMonthlyAmount = newAmount;
				member.nextContributionMonthlyAmount = undefined;
			}
		}

		if (nextExpiryDate.isAfter(member.memberPermission.date_expires)) {
			member.memberPermission.date_expires = nextExpiryDate.toDate();
		}

		await member.save();
	}

	static async updatePaymentStatus(gcPaymentId: string, status: string): Promise<void> {
		log.info({
			action: 'update-payment-status',
			data: {
				gcPaymentId, status
			}
		});
		await getRepository(Payment).update({ paymentId: gcPaymentId }, { status });
	}

	static async cancelSubscription(subscriptionId: string): Promise<void> {
		log.info({
			action: 'cancel-subscription',
			sensitive: {
				subscriptionId
			}
		});

		const gcData = await getRepository(GCPaymentData).findOne({ subscriptionId });
		const member = gcData && await Members.findById(gcData.memberId);

		if (member) {
			await GCPaymentService.cancelContribution(member);
		} else {
			log.info({
				action: 'unlink-subscription',
				sensitive: {
					subscriptionId
				}
			});
		}
	}

	static async cancelMandate(mandateId: string): Promise<void> {
		const gcData = await getRepository(GCPaymentData).findOne({ mandateId });

		if (gcData) {
			log.info({
				action: 'cancel-mandate',
				sensitive: {
					memberId: gcData.memberId,
					mandateId: gcData.mandateId
				}
			});

			await getRepository(GCPaymentData).update(gcData.memberId, {
				mandateId: undefined
			});
		} else {
			log.info({
				action: 'unlink-mandate',
				sensitive: {
					mandateId
				}
			});
		}
	}

	private static async calcPaymentExpiryDate(payment: Payment): Promise<Moment> {
		if (payment.subscriptionId) {
			const subscription = await gocardless.subscriptions.get(payment.subscriptionId);
			return subscription.upcoming_payments.length > 0 ?
				moment.utc(subscription.upcoming_payments[0].charge_date).add(config.gracePeriod) :
				moment.utc(payment.chargeDate).add(GCPaymentWebhookService.getSubscriptionDuration(subscription));
		} else {
			return moment.utc();
		}
	}

	private static async createPayment(gcPayment: GCPayment): Promise<Payment> {
		const payment = new Payment();
		payment.paymentId = gcPayment.id;

		const gcData = await getRepository(GCPaymentData).findOne({ mandateId: gcPayment.links.mandate });
		const member = gcData && await Members.findById(gcData.memberId);
		if (member) {
			log.info({
				action: 'create-payment',
				data: {
					memberId: member._id,
					gcPaymentId: gcPayment.id
				}
			});
			payment.memberId = member._id.toString();
		} else {
			log.info({
				action: 'create-unlinked-payment',
				data: {
					gcPaymentId: gcPayment.id
				}
			});
		}

		if (gcPayment.links.subscription) {
			const subscription = await gocardless.subscriptions.get(gcPayment.links.subscription);
			payment.subscriptionId = gcPayment.links.subscription;
			payment.subscriptionPeriod = GCPaymentWebhookService.getSubscriptionPeriod(subscription);
		}

		return payment;
	}

	private static getSubscriptionPeriod(subscription: Subscription): ContributionPeriod | undefined {
		const interval = Number(subscription.interval);
		const intervalUnit = subscription.interval_unit;
		if (interval === 12 && intervalUnit === SubscriptionIntervalUnit.Monthly ||
			interval === 1 && intervalUnit === SubscriptionIntervalUnit.Yearly)
			return ContributionPeriod.Annually;
		if (interval === 1 && intervalUnit === 'monthly')
			return ContributionPeriod.Monthly;

		log.error({
			action: 'get-subscription-period',
			data: { interval, intervalUnit }
		}, 'Unrecognised subscription period');
		return;
	}

	private static getSubscriptionDuration({ interval, interval_unit }: Subscription) {
		const unit = interval_unit === 'weekly' ? 'weeks' :
			interval_unit === 'monthly' ? 'months' : 'years';
		return moment.duration({ [unit]: Number(interval) });
	}

	private static getSubscriptionAmount(payment: Payment, payFee: boolean): number {
		const amount = payment.amount / (payment.subscriptionPeriod === ContributionPeriod.Annually ? 12 : 1);
		return payFee ? Math.round(100 * (amount - 0.2) * 0.99) / 100 : amount;
	}
}

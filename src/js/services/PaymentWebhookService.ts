import { Payment as GCPayment, Subscription, SubscriptionIntervalUnit } from 'gocardless-nodejs/types/Types';
import moment from 'moment';
import { getRepository } from 'typeorm';

import { Members } from '@core/database';
import gocardless from '@core/gocardless';
import { log } from '@core/logging';
import mandrill from '@core/mandrill';
import { ContributionPeriod } from '@core/utils';

import Payment from '@models/Payment';

import config from '@config';

export default class PaymentWebhookService {
	static async updatePayment(gcPaymentId: string): Promise<Payment> {
		const gcPayment = await gocardless.payments.get(gcPaymentId);
		let payment = await getRepository(Payment).findOne({paymentId: gcPayment.id});
		if (!payment) {
			payment = await PaymentWebhookService.createPayment(gcPayment);
		}

		payment.status = gcPayment.status;
		payment.description = gcPayment.description;
		payment.amount = Number(gcPayment.amount) / 100;
		payment.amountRefunded = Number(gcPayment.amount_refunded) / 100;
		payment.chargeDate = new Date(gcPayment.charge_date);

		await getRepository(Payment).save(payment);

		return payment;
	}

	static async confirmPayment(payment: Payment): Promise<void> {
		if (payment.memberId && payment.subscriptionId) {
			log.info({
				app: 'direct-debit',
				action: 'confirm-payment',
				data: {
					payment
				}
			});

			const member = await Members.findById(payment.memberId);
			// Ignore if the member has a new subscription as this will be for an old payment
			if (!member.gocardless.subscription_id || member.gocardless.subscription_id === payment.subscriptionId) {
				const subscription = await gocardless.subscriptions.get(payment.subscriptionId);
				const nextChargeDate = subscription.upcoming_payments.length > 0 ?
					moment.utc(subscription.upcoming_payments[0].charge_date).add(config.gracePeriod) :
					moment.utc(payment.chargeDate).add(PaymentWebhookService.getSubscriptionDuration(subscription));

				log.info({
					app: 'direct-debit',
					action: 'extend-membership',
					data: {
						subscriptionId: subscription.id,
						prevDate: member.memberPermission.date_expires,
						newDate: nextChargeDate
					}
				});

				member.gocardless.amount = payment.amount;
				member.gocardless.next_amount = undefined;
				if (nextChargeDate.isAfter(member.memberPermission.date_expires)) {
					member.memberPermission.date_expires = nextChargeDate.toDate();
				}

				await member.save();
			}
		}
	}

	static async updatePaymentStatus(gcPaymentId: string, status: string): Promise<void> {
		log.info({
			app: 'direct-debit',
			action: 'update-payment-status',
			data: {
				gcPaymentId, status
			}
		});
		await getRepository(Payment).update({paymentId: gcPaymentId}, {status});
	}

	static async cancelSubscription(subscriptionId: string): Promise<void> {
		const member = await Members.findOne( {
			'gocardless.subscription_id': subscriptionId,
			// Ignore users that cancelled online, we've already handled them
			'cancellation.satisified': { $exists: false }
		} );

		if ( member ) {
			member.gocardless.subscription_id = undefined;
			member.gocardless.cancelled_at = new Date();
			await member.save();
			await mandrill.sendToMember('cancelled-contribution', member);
		} else {
			log.info( {
				app: 'webhook',
				action: 'unlink-subscription',
				sensitive: {
					subscriptionId
				}
			} );
		}
	}

	static async cancelMandate(mandateId: string): Promise<void> {
		const member = await Members.findOne( { 'gocardless.mandate_id': mandateId } );

		if ( member ) {
			log.info( {
				app: 'webhook',
				action: 'cancel-mandate',
				sensitive: {
					member: member._id,
					mandateId
				}
			} );

			member.gocardless.mandate_id = undefined;
			await member.save();
		} else {
			log.info( {
				app: 'webhook',
				action: 'unlink-mandate',
				sensitive: {
					mandateId
				}
			} );
		}
	}

	private static async createPayment(gcPayment: GCPayment): Promise<Payment> {
		const payment = new Payment();
		payment.paymentId = gcPayment.id;

		const member = await Members.findOne( { 'gocardless.mandate_id': gcPayment.links.mandate } );
		if (member) {
			log.info({
				app: 'direct-debit',
				action: 'create-payment',
				data: {
					memberId: member._id,
					gcPaymentId: gcPayment.id
				}
			});
			payment.memberId = member._id.toString();
		} else {
			log.info({
				app: 'direct-debit',
				action: 'create-unlinked-payment',
				data: {
					gcPaymentId: gcPayment.id
				}
			});
		}

		if (gcPayment.links.subscription) {
			const subscription = await gocardless.subscriptions.get(gcPayment.links.subscription);
			payment.subscriptionId = gcPayment.links.subscription;
			payment.subscriptionPeriod = PaymentWebhookService.getSubscriptionPeriod(subscription);
		}

		return payment;
	}

	private static getSubscriptionPeriod(subscription: Subscription): ContributionPeriod|null {
		const interval = Number(subscription.interval);
		const intervalUnit = subscription.interval_unit;
		if (interval === 12 && intervalUnit === SubscriptionIntervalUnit.Monthly ||
				interval === 1 && intervalUnit === SubscriptionIntervalUnit.Yearly)
			return ContributionPeriod.Annually;
		if (interval === 1 && intervalUnit === 'monthly')
			return ContributionPeriod.Monthly;

		log.error({
			app: 'direct-debit',
			action: 'get-subscription-period',
			data: { interval, intervalUnit }
		}, 'Unrecognised subscription period');
		return null;
	}

	private static getSubscriptionDuration({interval, interval_unit}: Subscription) {
		const unit = interval_unit === 'weekly' ? 'weeks' :
			interval_unit === 'monthly' ? 'months' : 'years';
		return moment.duration({[unit]: Number(interval)});
	}
}

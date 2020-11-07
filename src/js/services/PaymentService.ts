import { Customer, CustomerCurrency, Subscription, SubscriptionIntervalUnit } from 'gocardless-nodejs/types/Types';

import gocardless from '@core/gocardless';
import { getChargeableAmount, cleanEmailAddress } from  '@core/utils';
import { ContributionPeriod, PartialMember } from '@core/services/MembersService';

export default class PaymentService {
	static isValidCustomer(customer: Customer): boolean {
		return customer.given_name != '' && customer.family_name != '';
	}

	static customerToMember(customer: Customer, mandateId: string): PartialMember {
		return {
			firstname: customer.given_name,
			lastname: customer.family_name,
			email: cleanEmailAddress(customer.email),
			delivery_optin: false,
			delivery_address: {
				line1: customer.address_line1,
				line2: customer.address_line2,
				city: customer.city,
				postcode: customer.postal_code
			},
			gocardless: {
				customer_id: customer.id,
				mandate_id: mandateId
			}
		};
	}

	static async createSubscription(amount: number, period: ContributionPeriod, payFee: boolean, mandateId:string, startDate?: Date): Promise<Subscription> {
		return await gocardless.subscriptions.create( {
			amount: getChargeableAmount(amount, period, payFee).toString(),
			currency: CustomerCurrency.GBP,
			interval_unit: period === ContributionPeriod.Annually ? SubscriptionIntervalUnit.Yearly: SubscriptionIntervalUnit.Monthly,
			name: 'Membership',
			links: {
				mandate: mandateId
			},
			...(startDate ? { start_date: startDate.toString() } : {})
		} );
	}
}
const gocardless = require('gocardless');
const { getChargeableAmount, cleanEmailAddress } = require( __js + '/utils' );

class PaymentService {
	static isValidCustomer(customer) {
		return customer.given_name && customer.family_name;
	}

	static customerToMember(customer, mandateId) {
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

	static async createSubscription(amount, period, payFee, mandateId, startDate = null) {
		return await gocardless.subscriptions.create( {
			amount: getChargeableAmount(amount, period, payFee),
			currency: 'GBP',
			interval_unit: period === 'annually' ? 'yearly' : 'monthly',
			name: 'Membership',
			links: {
				mandate: mandateId
			},
			...(startDate ? { start_date: startDate } : {})
		} );
	}
}

module.exports = PaymentService;

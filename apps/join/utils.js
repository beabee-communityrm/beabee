const moment = require( 'moment' );

const config = require( __config );

const auth = require( __js + '/authentication' );
const { JoinFlows, JTJStock, Members, Referrals } = require( __js + '/database' );
const gocardless = require( __js + '/gocardless' );
const postcodes = require( __js + '/postcodes' );
const mailchimp = require( __js + '/mailchimp' );
const mandrill = require( __js + '/mandrill' );
const { getActualAmount, getSubscriptionName } = require( __js + '/utils' );

const { gifts3, gifts5 } = require( './gifts.json' );
const giftsById = {};
gifts3.forEach(gift => giftsById[gift.id] = {...gift, minAmount: 3});
gifts5.forEach(gift => giftsById[gift.id] = {...gift, minAmount: 5});

async function customerToMember(customerId, mandateId) {
	const customer = await gocardless.customers.get(customerId);
	const billing_location = await postcodes.getLocation(customer.postal_code);

	return {
		firstname: customer.given_name,
		lastname: customer.family_name,
		email: customer.email,
		delivery_optin: false,
		delivery_address: {
			line1: customer.address_line1,
			line2: customer.address_line2,
			city: customer.city,
			postcode: customer.postal_code
		},
		billing_location,
		gocardless: {
			customer_id: customer.id,
			mandate_id: mandateId
		}
	};
}

function joinInfoToSubscription(amount, period, mandateId) {
	const actualAmount = getActualAmount(amount, period);

	return {
		amount: actualAmount * 100,
		currency: 'GBP',
		interval_unit: period === 'annually' ? 'yearly' : 'monthly',
		name: getSubscriptionName(actualAmount, period),
		links: {
			mandate: mandateId
		}
	};
}

function generateReferralCode({firstname, lastname}) {
	const no = ('000' + Math.floor(Math.random() * 1000)).slice(-3);
	return (firstname[0] + lastname[0] + no).toUpperCase();
}

// Should return schema defined in joinFormFields
function processJoinForm({
	amount, amountOther, period, referralCode, referralGift, referralGiftOptions
}) {

	return {
		amount: amount === 'other' ? parseInt(amountOther) : parseInt(amount),
		period,
		referralCode,
		referralGift,
		referralGiftOptions
	};
}

async function createJoinFlow(completeUrl, joinForm) {
	const sessionToken = auth.generateCode();
	const name =
		getSubscriptionName(getActualAmount(joinForm.amount, joinForm.period), joinForm.period);

	const redirectFlow = await gocardless.redirectFlows.create({
		description: name,
		session_token: sessionToken,
		success_redirect_url: completeUrl
	});

	await JoinFlows.create({
		redirect_flow_id: redirectFlow.id,
		sessionToken, joinForm
	});

	return redirectFlow.redirect_url;
}

async function completeJoinFlow(redirect_flow_id) {
	const joinFlow = await JoinFlows.findOneAndRemove({ redirect_flow_id });

	const redirectFlow = await gocardless.redirectFlows.complete(redirect_flow_id, {
		session_token: joinFlow.sessionToken
	});

	return {
		customerId: redirectFlow.links.customer,
		mandateId: redirectFlow.links.mandate,
		joinForm: joinFlow.joinForm
	};
}

async function createMember(memberObj) {
	try {
		return await Members.create({
			...memberObj,
			referralCode: generateReferralCode(memberObj),
			pollsCode: generateReferralCode(memberObj)
		});
	} catch (saveError) {
		const {code, message} = saveError;
		if (code === 11000 && (message.indexOf('referralCode') > -1 || message.indexOf('pollsCode') > -1)) {
			// Retry with a different referral code
			return await createMember(memberObj);
		}
		throw saveError;
	}
}

async function startMembership(member, {
	amount, period, referralCode, referralGift, referralGiftOptions
}) {
	if (member.gocardless.subscription_id) {
		throw new Error('Tried to create subscription on member with active subscription');
	} else {
		const subscription =
			await gocardless.subscriptions.create(joinInfoToSubscription(amount, period, member.gocardless.mandate_id));

		member.gocardless.subscription_id = subscription.id;
		member.gocardless.amount = amount;
		member.gocardless.period = period;
		member.memberPermission = {
			date_added: new Date(),
			date_expires: moment.utc(subscription.upcoming_payments[0].charge_date).add(config.gracePeriod).toDate()
		};
		await member.save();

		if (referralCode) {
			const referrer = await Members.findOne({referralCode});
			await Referrals.create({
				referrer: referrer._id,
				referee: member._id,
				refereeGift: referralGift,
				refereeGiftOptions: referralGiftOptions,
				refereeAmount: amount
			});

			await updateGiftStock({referralGift, referralGiftOptions});

			await mandrill.sendToMember('successful-referral', referrer, {
				refereeName: member.firstname,
				isEligible: amount >= 3
			});
		}

		await mailchimp.defaultLists.members.upsert(member.email, {
			email_address: member.email,
			merge_fields: {
				FNAME: member.firstname,
				LNAME: member.lastname,
				REFLINK: member.referralLink,
				VOTELINK: member.voteLink
			},
			status_if_new: 'subscribed'
		});
	}
}

async function getJTJInStock() {
	const jtjStock = await JTJStock.find({});
	const jtjInStock = {};
	jtjStock.forEach(stock => jtjInStock[stock.design] = stock.stock > 0);
	return jtjInStock;
}

async function isGiftAvailable({referralGift, referralGiftOptions, amount}) {
	if (referralGift === '') return true; // No gift option

	const gift = giftsById[referralGift];
	if (gift && gift.minAmount <= amount) {
		return referralGift !== 'jtj-mug' ||
			(await JTJStock.findOne({design: referralGiftOptions.Design})).stock > 0;
	}
	return false;
}

async function updateGiftStock({referralGift, referralGiftOptions}) {
	if (referralGift === 'jtj-mug') {
		await JTJStock.updateOne({design: referralGiftOptions.Design}, {$inc: {stock: -1}});
	}
}

module.exports = {
	processJoinForm,
	customerToMember,
	createJoinFlow,
	completeJoinFlow,
	createMember,
	startMembership,
	getJTJInStock,
	isGiftAvailable,
	updateGiftStock
};

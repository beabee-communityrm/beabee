import { Customer } from 'gocardless-nodejs/types/Types';
import { Document } from 'mongoose';

import auth from '@core/authentication';
import { JoinFlows } from '@core/database';
import gocardless from '@core/gocardless';
import { getActualAmount } from '@core/utils';

import { ContributionPeriod, Member } from '@core/services/MembersService';

interface RawJoinForm {
    amount: string,
    amountOther: string,
    period: ContributionPeriod,
    referralCode: string,
    referralGift: string,
    referralGiftOptions: Record<string, unknown>,
    payFee: boolean
}

export interface JoinForm {
    amount: number,
    period: ContributionPeriod,
    referralCode: string,
    referralGift: string,
    referralGiftOptions: Record<string, unknown>,
    payFee: boolean
}

export interface CompletedJoinFlow {
    customer: Customer,
    mandateId: string,
    joinForm: JoinForm
}

interface JoinFlow extends Document {
    date: Date,
    redirect_flow_id: string,
    sessionToken: string,
    joinForm: JoinForm
}

export interface RestartFlow extends Document {
	code: string,
	member: Member,
	date: Date,
	customerId: string,
	mandateId: string
	joinForm: JoinForm
}

export default class JoinFlowService {
	static processJoinForm({
		amount, amountOther, period, referralCode, referralGift, referralGiftOptions, payFee
	}: RawJoinForm): JoinForm {

		return {
			amount: amount === 'other' ? parseInt(amountOther) : parseInt(amount),
			period,
			referralCode,
			referralGift,
			referralGiftOptions,
			payFee
		};
	}

	static async createJoinFlow(completeUrl: string, joinForm: JoinForm, redirectFlowParams={}): Promise<string> {
		const sessionToken = auth.generateCode();
		const actualAmount = getActualAmount(joinForm.amount, joinForm.period);

		const redirectFlow = await gocardless.redirectFlows.create({
			description: `Membership: £${actualAmount}/${joinForm.period}${joinForm.payFee ? ' (+ fee)' : ''}`,
			session_token: sessionToken,
			success_redirect_url: completeUrl,
			...redirectFlowParams
		});

		await JoinFlows.create({
			redirect_flow_id: redirectFlow.id,
			sessionToken, joinForm
		});

		return redirectFlow.redirect_url;
	}

	static async completeJoinFlow(redirect_flow_id: string): Promise<CompletedJoinFlow> {
		const joinFlow = <JoinFlow>await JoinFlows.findOneAndRemove({ redirect_flow_id });

		const redirectFlow = await gocardless.redirectFlows.complete(redirect_flow_id, {
			session_token: joinFlow.sessionToken
		});

		const customer = await gocardless.customers.get(redirectFlow.links.customer);

		return {
			customer,
			mandateId: redirectFlow.links.mandate,
			joinForm: joinFlow.joinForm
		};
	}

}

module.exports = JoinFlowService;

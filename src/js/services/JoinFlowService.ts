import { Customer } from 'gocardless-nodejs/types/Types';
import { getRepository } from 'typeorm';

import auth from '@core/authentication';
import gocardless from '@core/gocardless';
import { ContributionPeriod, getActualAmount } from '@core/utils';

import JoinFlow, { JoinForm } from '@models/JoinFlow';

interface RawJoinForm {
    amount: string,
    amountOther: string,
    period: ContributionPeriod,
    referralCode: string,
    referralGift: string,
    referralGiftOptions: Record<string, unknown>,
    payFee: boolean
}

interface CompletedJoinFlow {
    customer: Customer,
    mandateId: string,
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
			payFee,
			prorate: false
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

		const joinFlow = new JoinFlow();
		joinFlow.redirectFlowId = redirectFlow.id;
		joinFlow.sessionToken = sessionToken;
		joinFlow.joinForm = joinForm;

		await getRepository(JoinFlow).save(joinFlow);

		return redirectFlow.redirect_url;
	}

	static async completeJoinFlow(redirectFlowId: string): Promise<CompletedJoinFlow> {
		const joinFlowRepository = getRepository(JoinFlow);
		const joinFlow = await joinFlowRepository.findOne({redirectFlowId});

		const redirectFlow = await gocardless.redirectFlows.complete(redirectFlowId, {
			session_token: joinFlow.sessionToken
		});

		const customer = await gocardless.customers.get(redirectFlow.links.customer);

		await joinFlowRepository.delete(joinFlow.id);

		return {
			customer,
			mandateId: redirectFlow.links.mandate,
			joinForm: joinFlow.joinForm
		};
	}

}

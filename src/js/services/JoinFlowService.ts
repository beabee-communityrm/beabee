import auth from '@core/authentication';
import { JoinFlows } from '@core/database';
import gocardless from '@core/gocardless';
import { getActualAmount } from '@core/utils';

import { CompletedJoinFlow, JoinFlow, JoinForm, RawJoinForm } from '@models/join-flows';

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

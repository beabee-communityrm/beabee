import { getRepository } from 'typeorm';

import auth from '@core/authentication';
import gocardless from '@core/gocardless';
import { getActualAmount } from '@core/utils';

import JoinFlow, { JoinForm } from '@models/JoinFlow';

export interface CompletedJoinFlow {
    customerId: string,
    mandateId: string,
    joinForm: JoinForm
}

export default class JoinFlowService {
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

		await joinFlowRepository.delete(joinFlow.id);

		return {
			customerId: redirectFlow.links.customer,
			mandateId: redirectFlow.links.mandate,
			joinForm: joinFlow.joinForm
		};
	}

}

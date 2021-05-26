import { IsBoolean, IsEmail, IsEnum, IsString, Min } from 'class-validator';
import { Body, BodyParam, HttpError, JsonController, NotFoundError, OnUndefined, Post } from 'routing-controllers';

import { ContributionPeriod, isDuplicateIndex } from '@core/utils';
import { generateJWTToken, generatePassword } from '@core/utils/auth';

import EmailService from '@core/services/EmailService';
import GCPaymentService from '@core/services/GCPaymentService';
import JoinFlowService, { CompletedJoinFlow } from '@core/services/JoinFlowService';
import MembersService from '@core/services/MembersService';

import Member from '@models/Member';

class SignupData {
	@IsEmail()
	email!: string

	@IsString()
	// TODO: password requirement checks?
	password!: string

	@Min(1)
	amount!: number

	@IsEnum(ContributionPeriod)
	period!: ContributionPeriod

	@IsBoolean()
	payFee!: boolean

	@IsString()
	completeUrl!: string
}

type SignupErrorCode = 'duplicate-email'|'restart-membership'|'restart-failed';

class SignupError extends HttpError {
	constructor(readonly code: SignupErrorCode) {
		super(401);
		Object.setPrototypeOf(this, SignupError.prototype);
	}

	toJSON() {
		return {
			status: 401,
			code: this.code
		};
	}
}

async function handleJoin(member: Member, {customerId, mandateId, joinForm}: CompletedJoinFlow): Promise<void> {
	await GCPaymentService.updatePaymentMethod(member, customerId, mandateId);
	await GCPaymentService.updateContribution(member, joinForm);
	await EmailService.sendTemplateToMember('welcome', member);
}

@JsonController('/signup')
export class SignupController {

	@Post('/')
	async startSignup(@Body() data: SignupData): Promise<{redirectUrl: string}> {
		const redirectUrl = await JoinFlowService.createJoinFlow(data.completeUrl, {
			...data,
			password: await generatePassword(data.password),
			prorate: false
		}, {
			prefilled_customer: {
				email: data.email
			}
		});
		return {
			redirectUrl
		};
	}

	@Post('/complete')
	@OnUndefined(201)
	async completeSignup(@BodyParam('redirectFlowId') redirectFlowId: string): Promise<void> {
		const joinFlow = await JoinFlowService.completeJoinFlow(redirectFlowId);
		if (!joinFlow) {
			throw new NotFoundError();
		}

		const {partialMember, partialProfile} = await GCPaymentService.customerToMember(joinFlow);

		try {
			const newMember = await MembersService.createMember(partialMember, partialProfile);
			await handleJoin(newMember, joinFlow);
		} catch (error) {
			if (isDuplicateIndex(error, 'email')) {
				const oldMember = await MembersService.findOne({email: partialMember.email});
				// This should never be able to happen
				if (!oldMember) { throw error; }

				if (oldMember.isActiveMember) {
					throw new SignupError('duplicate-email');
				} else {
					const restartFlow = await JoinFlowService.createRestartFlow(oldMember, joinFlow);
					await EmailService.sendTemplateToMember('restart-membership', oldMember, {code: restartFlow.id});
					throw new SignupError('restart-membership');
				}
			} else {
				throw error;
			}
		}
	}

	@Post('/restart')
	@OnUndefined(201)
	async completeRestart(@BodyParam('redirectFlowId') redirectFlowId: string): Promise<void> {
		const restartFlow = await JoinFlowService.completeRestartFlow(redirectFlowId);
		if (!restartFlow) {
			throw new NotFoundError();
		}

		if (restartFlow.member.isActiveMember) {
			throw new SignupError('restart-failed');
		} else {
			await handleJoin(restartFlow.member, restartFlow);
		}
	}
}

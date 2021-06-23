import { IsBoolean, IsEmail, IsEnum, IsString, Min } from 'class-validator';
import { Request } from 'express';
import { Body, BodyParam, HttpError, JsonController, NotFoundError, Post, Req } from 'routing-controllers';

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

interface SignupStart {
	redirectUrl: string
}

interface SignupSuccess {
	jwt: string
}

async function handleJoin(req: Request, member: Member, joinFlow: CompletedJoinFlow): Promise<SignupSuccess> {
	await GCPaymentService.updatePaymentMethod(member, joinFlow.customerId, joinFlow.mandateId);
	await GCPaymentService.updateContribution(member, joinFlow.joinForm);
	await EmailService.sendTemplateToMember('welcome', member);

	const jwt = generateJWTToken(member);
	
	// For now also send a normal login cookie
	await new Promise<void>((resolve, reject) => {
		req.login(member, (error) => {
			if (error) reject(error);
			else resolve();
		});
	});

	return {jwt};
}

@JsonController('/signup')
export class SignupController {

	@Post('/')
	async startSignup(@Body() data: SignupData): Promise<SignupStart> {
		const redirectUrl = await JoinFlowService.createJoinFlow(data.completeUrl, {
			...data,
			monthlyAmount: data.period === ContributionPeriod.Monthly ? data.amount : data.amount / 12,
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
	async completeSignup(@Req() req: Request, @BodyParam('redirectFlowId') redirectFlowId: string): Promise<SignupSuccess> {
		const joinFlow = await JoinFlowService.completeJoinFlow(redirectFlowId);
		if (!joinFlow) {
			throw new NotFoundError();
		}

		const {partialMember, partialProfile} = await GCPaymentService.customerToMember(joinFlow);

		try {
			const newMember = await MembersService.createMember(partialMember, partialProfile);
			return await handleJoin(req, newMember, joinFlow);
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
	async completeRestart(@Req() req: Request, @BodyParam('redirectFlowId') redirectFlowId: string): Promise<SignupSuccess> {
		const restartFlow = await JoinFlowService.completeRestartFlow(redirectFlowId);
		if (!restartFlow) {
			throw new NotFoundError();
		}

		if (restartFlow.member.isActiveMember) {
			throw new SignupError('restart-failed');
		} else {
			return await handleJoin(req, restartFlow.member, restartFlow);
		}
	}
}

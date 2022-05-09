import { Request } from "express";
import {
  Body,
  JsonController,
  NotFoundError,
  OnUndefined,
  Post,
  Req
} from "routing-controllers";
import { getRepository } from "typeorm";

import { generatePassword } from "@core/utils/auth";

import { PaymentFlowParams } from "@core/providers/payment";

import JoinFlowService from "@core/services/JoinFlowService";

import JoinFlow from "@models/JoinFlow";

import {
  SignupData,
  SignupCompleteData,
  SignupConfirmEmailParam
} from "@api/data/SignupData";
import { login } from "@api/utils";

@JsonController("/signup")
export class SignupController {
  @OnUndefined(204)
  @Post("/")
  async startSignup(
    @Body() data: SignupData
  ): Promise<PaymentFlowParams | undefined> {
    const baseForm = {
      email: data.email,
      password: await generatePassword(data.password)
    };

    if (data.contribution) {
      return await JoinFlowService.createPaymentJoinFlow(
        {
          ...baseForm,
          ...data.contribution,
          monthlyAmount: data.contribution.monthlyAmount
        },
        data,
        data.contribution.completeUrl,
        { email: data.email }
      );
    } else {
      const joinFlow = await JoinFlowService.createJoinFlow(baseForm, data);
      await JoinFlowService.sendConfirmEmail(joinFlow);
    }
  }

  @Post("/complete")
  async completeSignup(@Body() data: SignupCompleteData): Promise<void> {
    const joinFlow = await JoinFlowService.getJoinFlowByPaymentId(
      data.paymentFlowId
    );
    if (joinFlow) {
      await JoinFlowService.sendConfirmEmail(joinFlow);
    }
  }

  @OnUndefined(204)
  @Post("/confirm-email")
  async confirmEmail(
    @Req() req: Request,
    @Body() { joinFlowId }: SignupConfirmEmailParam
  ): Promise<void> {
    const joinFlow = await getRepository(JoinFlow).findOne(joinFlowId);
    if (!joinFlow) {
      throw new NotFoundError();
    }

    const member = await JoinFlowService.completeConfirmEmail(joinFlow);
    await login(req, member);
  }
}

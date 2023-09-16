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

import PaymentFlowService from "@core/services/PaymentFlowService";

import { PaymentFlowParams } from "@core/providers/payment-flow";

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
      password: data.password
        ? await generatePassword(data.password)
        : { tries: 0, salt: "", iterations: 0, hash: "" }
    };

    if (data.contribution) {
      return await PaymentFlowService.createPaymentJoinFlow(
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
      const joinFlow = await PaymentFlowService.createJoinFlow(baseForm, data);
      await PaymentFlowService.sendConfirmEmail(joinFlow);
    }
  }

  @OnUndefined(204)
  @Post("/complete")
  async completeSignup(@Body() data: SignupCompleteData): Promise<void> {
    const joinFlow = await PaymentFlowService.getJoinFlowByPaymentId(
      data.paymentFlowId
    );
    if (!joinFlow) {
      throw new NotFoundError();
    }

    if (data.firstname || data.lastname) {
      joinFlow.joinForm.firstname = data.firstname || null;
      joinFlow.joinForm.lastname = data.lastname || null;
      await getRepository(JoinFlow).save(joinFlow);
    }

    await PaymentFlowService.sendConfirmEmail(joinFlow);
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

    const contact = await PaymentFlowService.completeConfirmEmail(joinFlow);
    await login(req, contact);
  }
}

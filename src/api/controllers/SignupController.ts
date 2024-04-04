import { plainToInstance } from "class-transformer";
import { Request } from "express";
import {
  Body,
  JsonController,
  NotFoundError,
  OnUndefined,
  Post,
  Req
} from "routing-controllers";

import { getRepository } from "@core/database";
import { generatePassword } from "@core/utils/auth";

import PaymentFlowService from "@core/services/PaymentFlowService";

import { GetPaymentFlowDto } from "@api/dto/PaymentFlowDto";
import {
  StartSignupFlowDto,
  CompleteSignupFlowDto
} from "@api/dto/SignupFlowDto";
import { SignupConfirmEmailParams } from "@api/params/SignupConfirmEmailParams";
import { login } from "@api/utils";

import JoinFlow from "@models/JoinFlow";
import Password from "@models/Password";

@JsonController("/signup")
export class SignupController {
  @OnUndefined(204)
  @Post("/")
  async startSignup(
    @Body() data: StartSignupFlowDto
  ): Promise<GetPaymentFlowDto | undefined> {
    const baseForm = {
      email: data.email,
      password: data.password
        ? await generatePassword(data.password)
        : Password.none
    };

    if (data.contribution) {
      const flow = await PaymentFlowService.createPaymentJoinFlow(
        {
          ...baseForm,
          ...data.contribution,
          monthlyAmount: data.contribution.monthlyAmount
        },
        data,
        data.contribution.completeUrl,
        { email: data.email }
      );

      return plainToInstance(GetPaymentFlowDto, flow);
    } else {
      const joinFlow = await PaymentFlowService.createJoinFlow(baseForm, data);
      await PaymentFlowService.sendConfirmEmail(joinFlow);
    }
  }

  @OnUndefined(204)
  @Post("/complete")
  async completeSignup(@Body() data: CompleteSignupFlowDto): Promise<void> {
    const joinFlow = await PaymentFlowService.getJoinFlowByPaymentId(
      data.paymentFlowId
    );
    if (!joinFlow) {
      throw new NotFoundError();
    }

    // Merge additional data into the join form
    if (data.firstname || data.lastname || data.vatNumber) {
      Object.assign(joinFlow.joinForm, data);
      await getRepository(JoinFlow).save(joinFlow);
    }

    await PaymentFlowService.sendConfirmEmail(joinFlow);
  }

  @OnUndefined(204)
  @Post("/confirm-email")
  async confirmEmail(
    @Req() req: Request,
    @Body() { joinFlowId }: SignupConfirmEmailParams
  ): Promise<void> {
    const joinFlow = await getRepository(JoinFlow).findOneBy({
      id: joinFlowId
    });
    if (!joinFlow) {
      throw new NotFoundError();
    }

    const contact = await PaymentFlowService.completeConfirmEmail(joinFlow);
    await login(req, contact);
  }
}

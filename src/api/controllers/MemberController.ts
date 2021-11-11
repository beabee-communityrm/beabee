import { IsBoolean, IsNumber } from "class-validator";
import {
  Body,
  CurrentUser,
  Get,
  JsonController,
  NotFoundError,
  OnUndefined,
  Patch,
  Post,
  Put
} from "routing-controllers";
import { getRepository } from "typeorm";

import GCPaymentService from "@core/services/GCPaymentService";
import JoinFlowService from "@core/services/JoinFlowService";
import MembersService from "@core/services/MembersService";
import PaymentService, { PaymentSource } from "@core/services/PaymentService";

import { ContributionPeriod } from "@core/utils";
import { generatePassword } from "@core/utils/auth";

import Member from "@models/Member";
import MemberProfile from "@models/MemberProfile";

import config from "@config";

import { GetMemberData, UpdateMemberData } from "@api/data/MemberData";
import {
  CompleteJoinFlowData,
  StartJoinFlowData
} from "@api/data/JoinFlowData";
import {
  ContributionData,
  StartContributionData
} from "@api/data/ContributionData";

import CantUpdateContribution from "@api/errors/CantUpdateContribution";
import { validateOrReject } from "@api/utils";

class UpdateContributionData {
  @IsNumber()
  amount!: number;

  @IsBoolean()
  payFee!: boolean;

  @IsBoolean()
  prorate!: boolean;
}

async function memberToApiMember(member: Member): Promise<GetMemberData> {
  const profile = await getRepository(MemberProfile).findOneOrFail({ member });

  return {
    email: member.email,
    firstname: member.firstname,
    lastname: member.lastname,
    profile: {
      deliveryOptIn: !!profile.deliveryOptIn,
      deliveryAddress: profile.deliveryAddress,
      newsletterStatus: profile.newsletterStatus
    },
    joined: member.joined,
    contributionPeriod: member.contributionPeriod,
    ...(member.contributionMonthlyAmount !== undefined && {
      contributionAmount:
        member.contributionMonthlyAmount *
        (member.contributionPeriod === ContributionPeriod.Monthly ? 1 : 12),
      contributionCurrencyCode: config.currencyCode
    })
  };
}

@JsonController("/member")
export class MemberController {
  @Get("/me")
  async getMe(
    @CurrentUser({ required: true }) member: Member
  ): Promise<GetMemberData> {
    return await memberToApiMember(member);
  }

  @Put("/me")
  async updateMe(
    @CurrentUser({ required: true }) member: Member,
    @Body({ required: true, validate: { skipMissingProperties: true } })
    data: UpdateMemberData
  ): Promise<GetMemberData> {
    if (data.email || data.firstname || data.lastname || data.password) {
      await MembersService.updateMember(member, {
        ...(data.email && { email: data.email }),
        ...(data.firstname && { firstname: data.firstname }),
        ...(data.lastname && { lastname: data.lastname }),
        ...(data.password && {
          password: await generatePassword(data.password)
        })
      });
    }

    if (data.profile) {
      await MembersService.updateMemberProfile(member, data.profile);
    }

    return await memberToApiMember(member);
  }

  @Patch("/me/contribution")
  async updateContribution(
    @CurrentUser({ required: true }) member: Member,
    @Body({ required: true }) _data: UpdateContributionData
  ): Promise<void> {
    // TODO: how can we move this into validators?
    const data = new ContributionData();
    data.amount = _data.amount;
    data.period = member.contributionPeriod!;
    data.payFee = _data.payFee;
    await validateOrReject(data);

    if (!(await GCPaymentService.canChangeContribution(member, true))) {
      throw new CantUpdateContribution();
    }

    await GCPaymentService.updateContribution(member, {
      monthlyAmount:
        member.contributionPeriod === ContributionPeriod.Monthly
          ? data.amount
          : data.amount / 12,
      period: member.contributionPeriod!,
      payFee: data.payFee,
      prorate: false
    });
  }

  @Get("/me/payment-source")
  async getPaymentSource(
    @CurrentUser({ required: true }) member: Member
  ): Promise<PaymentSource | undefined> {
    return await PaymentService.getPaymentSource(member);
  }

  @Put("/me/payment-source")
  async updatePaymentSource(
    @CurrentUser({ required: true }) member: Member,
    @Body({ required: true }) data: StartJoinFlowData
  ): Promise<{ redirectUrl: string }> {
    if (!(await GCPaymentService.canChangeContribution(member, false))) {
      throw new CantUpdateContribution();
    }

    const redirectUrl = await JoinFlowService.createJoinFlow(
      data.completeUrl,
      // TODO: this is all unnecessary, we should remove this
      {
        monthlyAmount: 0,
        period: ContributionPeriod.Monthly,
        password: await generatePassword(""),
        email: "",
        payFee: true,
        prorate: false
      },
      {
        prefilled_customer: {
          email: member.email,
          given_name: member.firstname,
          family_name: member.lastname
        }
      }
    );
    return {
      redirectUrl
    };
  }

  @OnUndefined(204)
  @Post("/me/payment-source/complete")
  async completeUpdatePaymentSource(
    @CurrentUser({ required: true }) member: Member,
    @Body({ required: true }) data: CompleteJoinFlowData
  ): Promise<void> {
    if (!(await GCPaymentService.canChangeContribution(member, false))) {
      throw new CantUpdateContribution();
    }

    const joinFlow = await getRepository(JoinFlow).findOne({
      redirectFlowId: data.redirectFlowId
    });
    if (!joinFlow) {
      throw new NotFoundError();
    }

    const { customerId, mandateId } = await JoinFlowService.completeJoinFlow(
      joinFlow
    );
    await GCPaymentService.updatePaymentMethod(member, customerId, mandateId);
  }
}

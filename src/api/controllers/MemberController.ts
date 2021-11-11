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
    contributionType: member.contributionType,
    contributionPeriod: member.contributionPeriod,
    ...(member.contributionMonthlyAmount !== undefined && {
      contributionAmount:
        member.contributionMonthlyAmount *
        (member.contributionPeriod === ContributionPeriod.Monthly ? 1 : 12)
    }),
    roles: member.permissions.filter((p) => p.isActive).map((p) => p.permission)
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
    @Body({ required: true }) data: UpdateContributionData
  ): Promise<void> {
    // TODO: can we move this into validators?
    const contributionData = new ContributionData();
    contributionData.amount = data.amount;
    contributionData.period = member.contributionPeriod!;
    contributionData.payFee = data.payFee;
    await validateOrReject(contributionData);

    if (!(await GCPaymentService.canChangeContribution(member, true))) {
      throw new CantUpdateContribution();
    }

    await GCPaymentService.updateContribution(member, {
      ...data,
      monthlyAmount: contributionData.monthlyAmount,
      period: contributionData.period
    });
  }

  @Post("/me/contribution")
  async startContribution(
    @CurrentUser({ required: true }) member: Member,
    @Body({ required: true }) data: StartContributionData
  ): Promise<{ redirectUrl: string }> {
    if (!(await GCPaymentService.canChangeContribution(member, false))) {
      throw new CantUpdateContribution();
    }

    const redirectUrl = await JoinFlowService.createJoinFlow(
      data.completeUrl,
      {
        ...data,
        monthlyAmount: data.monthlyAmount,
        prorate: false,
        // TODO: unnecessary, should be optional
        password: await generatePassword(""),
        email: ""
      },
      member
    );

    return { redirectUrl };
  }

  @OnUndefined(204)
  @Post("/me/contribution/complete")
  async completeStartContribution(
    @CurrentUser({ required: true }) member: Member,
    @Body({ required: true }) data: CompleteJoinFlowData
  ): Promise<void> {
    if (!(await GCPaymentService.canChangeContribution(member, false))) {
      throw new CantUpdateContribution();
    }

    const joinFlow = await JoinFlowService.getJoinFlow(data.redirectFlowId);
    if (!joinFlow) {
      throw new NotFoundError();
    }

    const { customerId, mandateId } = await JoinFlowService.completeJoinFlow(
      joinFlow
    );
    await GCPaymentService.updatePaymentMethod(member, customerId, mandateId);
    await GCPaymentService.updateContribution(member, joinFlow.joinForm);
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
      member
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

    const joinFlow = await JoinFlowService.getJoinFlow(data.redirectFlowId);
    if (!joinFlow) {
      throw new NotFoundError();
    }

    const { customerId, mandateId } = await JoinFlowService.completeJoinFlow(
      joinFlow
    );
    await GCPaymentService.updatePaymentMethod(member, customerId, mandateId);
  }
}

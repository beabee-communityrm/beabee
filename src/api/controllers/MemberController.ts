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
  GetContributionData,
  SetContributionData,
  StartContributionData,
  UpdateContributionData
} from "@api/data/ContributionData";

import CantUpdateContribution from "@api/errors/CantUpdateContribution";
import { validateOrReject } from "@api/utils";
import PaymentService from "@core/services/PaymentService";

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

  @Get("/me/contribution")
  async getContribution(
    @CurrentUser({ required: true }) member: Member
  ): Promise<GetContributionData | undefined> {
    return await PaymentService.getContributionInfo(member);
  }

  @OnUndefined(204)
  @Patch("/me/contribution")
  async updateContribution(
    @CurrentUser({ required: true }) member: Member,
    @Body({ required: true }) data: UpdateContributionData
  ): Promise<void> {
    // TODO: can we move this into validators?
    const contributionData = new SetContributionData();
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
    return await this.handleStartUpdatePaymentSource(member, data);
  }

  @OnUndefined(204)
  @Post("/me/contribution/complete")
  async completeStartContribution(
    @CurrentUser({ required: true }) member: Member,
    @Body({ required: true }) data: CompleteJoinFlowData
  ): Promise<void> {
    const joinFlow = await this.handleCompleteUpdatePaymentSource(member, data);
    await GCPaymentService.updateContribution(member, joinFlow.joinForm);
  }

  @Put("/me/payment-source")
  async updatePaymentSource(
    @CurrentUser({ required: true }) member: Member,
    @Body({ required: true }) data: StartJoinFlowData
  ): Promise<{ redirectUrl: string }> {
    return await this.handleStartUpdatePaymentSource(member, {
      ...data,
      // TODO: not needed, should be optional
      amount: 0,
      period: ContributionPeriod.Annually,
      monthlyAmount: 0,
      payFee: false
    });
  }

  @OnUndefined(204)
  @Post("/me/payment-source/complete")
  async completeUpdatePaymentSource(
    @CurrentUser({ required: true }) member: Member,
    @Body({ required: true }) data: CompleteJoinFlowData
  ): Promise<void> {
    await this.handleCompleteUpdatePaymentSource(member, data);
  }

  private async handleStartUpdatePaymentSource(
    member: Member,
    data: StartContributionData
  ) {
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
    return {
      redirectUrl
    };
  }

  private async handleCompleteUpdatePaymentSource(
    member: Member,
    data: CompleteJoinFlowData
  ) {
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

    return joinFlow;
  }
}

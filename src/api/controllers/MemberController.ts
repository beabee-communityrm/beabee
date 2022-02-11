import { Request } from "express";
import {
  Authorized,
  Body,
  createParamDecorator,
  CurrentUser,
  Get,
  JsonController,
  NotFoundError,
  OnUndefined,
  Patch,
  Post,
  Put,
  QueryParams,
  UnauthorizedError
} from "routing-controllers";
import { getRepository } from "typeorm";

import EmailService from "@core/services/EmailService";
import JoinFlowService from "@core/services/JoinFlowService";
import MembersService from "@core/services/MembersService";
import PaymentService from "@core/services/PaymentService";

import { ContributionInfo, ContributionPeriod } from "@core/utils";
import { generatePassword } from "@core/utils/auth";

import Member from "@models/Member";
import MemberProfile from "@models/MemberProfile";

import { Paginated, UUIDParam } from "@api/data";
import {
  GetMemberData,
  GetMemberQuery,
  GetMembersQuery,
  GetMemberWith,
  UpdateMemberData
} from "@api/data/MemberData";
import {
  CompleteJoinFlowData,
  StartJoinFlowData
} from "@api/data/JoinFlowData";
import {
  SetContributionData,
  StartContributionData,
  UpdateContributionData
} from "@api/data/ContributionData";

import PartialBody from "@api/decorators/PartialBody";
import CantUpdateContribution from "@api/errors/CantUpdateContribution";
import { validateOrReject } from "@api/utils";
import { fetchPaginatedMembers, memberToData } from "@api/utils/members";

// The target user can either be the current user or for admins
// it can be any user, this decorator injects the correct target
// and also ensures the user has the correct permissions
function TargetUser() {
  return createParamDecorator({
    required: true,
    value: async (action): Promise<Member> => {
      const request: Request = action.request;
      const user = request.user;
      if (!user) {
        throw new UnauthorizedError();
      }

      const id = request.params.id;
      if (id === "me" || id === user.id) {
        return user;
      } else if (!user.hasPermission("admin")) {
        throw new UnauthorizedError();
      } else {
        const uuid = new UUIDParam();
        uuid.id = id;
        await validateOrReject(uuid);

        const target = await MembersService.findOne(id);
        if (target) {
          return target;
        } else {
          throw new NotFoundError();
        }
      }
    }
  });
}

@JsonController("/member")
@Authorized()
export class MemberController {
  @Authorized("admin")
  @Get("/")
  async getMembers(
    @QueryParams() query: GetMembersQuery
  ): Promise<Paginated<GetMemberData>> {
    return await fetchPaginatedMembers(query, {
      with: query.with,
      withRestricted: true
    });
  }

  @Get("/:id")
  async getMember(
    @CurrentUser() member: Member,
    @TargetUser() target: Member,
    @QueryParams() query: GetMemberQuery
  ): Promise<GetMemberData> {
    if (query.with?.includes(GetMemberWith.Profile)) {
      target.profile = await getRepository(MemberProfile).findOneOrFail({
        member: target
      });
    }
    return memberToData(target, {
      with: query.with,
      withRestricted: member.hasPermission("admin")
    });
  }

  @Patch("/:id")
  async updateMember(
    @CurrentUser() member: Member,
    @TargetUser() target: Member,
    @PartialBody() data: UpdateMemberData
  ): Promise<GetMemberData> {
    if (data.email || data.firstname || data.lastname || data.password) {
      await MembersService.updateMember(target, {
        ...(data.email && { email: data.email }),
        ...(data.firstname && { firstname: data.firstname }),
        ...(data.lastname && { lastname: data.lastname }),
        ...(data.password && {
          password: await generatePassword(data.password)
        })
      });
    }

    if (data.profile) {
      if (
        !member.hasPermission("admin") &&
        (data.profile.tags || data.profile.notes || data.profile.description)
      ) {
        throw new UnauthorizedError();
      }

      await MembersService.updateMemberProfile(target, data.profile);
    }

    return await this.getMember(member, target, {
      with: data.profile ? [GetMemberWith.Profile] : []
    });
  }

  @Get("/:id/contribution")
  async getContribution(
    @TargetUser() target: Member
  ): Promise<ContributionInfo> {
    return await PaymentService.getContributionInfo(target);
  }

  @Patch("/:id/contribution")
  async updateContribution(
    @TargetUser() target: Member,
    @Body() data: UpdateContributionData
  ): Promise<ContributionInfo> {
    // TODO: can we move this into validators?
    const contributionData = new SetContributionData();
    contributionData.amount = data.amount;
    contributionData.period = target.contributionPeriod!;
    contributionData.payFee = data.payFee;
    contributionData.prorate = data.prorate;
    await validateOrReject(contributionData);

    if (!(await PaymentService.canChangeContribution(target, true))) {
      throw new CantUpdateContribution();
    }

    await PaymentService.updateContribution(target, contributionData);

    return await this.getContribution(target);
  }

  @Post("/:id/contribution")
  async startContribution(
    @TargetUser() target: Member,
    @Body() data: StartContributionData
  ): Promise<{ redirectUrl: string }> {
    return await this.handleStartUpdatePaymentSource(target, data);
  }

  @OnUndefined(204)
  @Post("/:id/contribution/cancel")
  async cancelContribution(@TargetUser() target: Member): Promise<void> {
    await PaymentService.cancelContribution(target);
    await EmailService.sendTemplateToMember(
      "cancelled-contribution-no-survey",
      target
    );
  }

  @Post("/:id/contribution/complete")
  async completeStartContribution(
    @TargetUser() target: Member,
    @Body() data: CompleteJoinFlowData
  ): Promise<ContributionInfo> {
    const joinFlow = await this.handleCompleteUpdatePaymentSource(target, data);
    await PaymentService.updateContribution(target, joinFlow.joinForm);
    return await this.getContribution(target);
  }

  @Put("/:id/payment-source")
  async updatePaymentSource(
    @TargetUser() target: Member,
    @Body() data: StartJoinFlowData
  ): Promise<{ redirectUrl: string }> {
    return await this.handleStartUpdatePaymentSource(target, {
      ...data,
      // TODO: not needed, should be optional
      amount: 0,
      period: ContributionPeriod.Annually,
      monthlyAmount: 0,
      payFee: false,
      prorate: false
    });
  }

  @Post("/:id/payment-source/complete")
  async completeUpdatePaymentSource(
    @TargetUser() target: Member,
    @Body() data: CompleteJoinFlowData
  ): Promise<ContributionInfo> {
    await this.handleCompleteUpdatePaymentSource(target, data);
    return await this.getContribution(target);
  }

  private async handleStartUpdatePaymentSource(
    target: Member,
    data: StartContributionData
  ) {
    if (!(await PaymentService.canChangeContribution(target, false))) {
      throw new CantUpdateContribution();
    }

    const { redirectUrl } = await JoinFlowService.createJoinFlow(
      {
        ...data,
        monthlyAmount: data.monthlyAmount,
        // TODO: unnecessary, should be optional
        password: await generatePassword(""),
        email: ""
      },
      data.completeUrl,
      target
    );
    return {
      redirectUrl
    };
  }

  private async handleCompleteUpdatePaymentSource(
    target: Member,
    data: CompleteJoinFlowData
  ) {
    if (!(await PaymentService.canChangeContribution(target, false))) {
      throw new CantUpdateContribution();
    }

    const joinFlow = await JoinFlowService.getJoinFlow(data.redirectFlowId);
    if (!joinFlow) {
      throw new NotFoundError();
    }

    const completedJoinFlow = await JoinFlowService.completeJoinFlow(joinFlow);
    if (completedJoinFlow) {
      await PaymentService.updatePaymentSource(
        target,
        completedJoinFlow.customerId,
        completedJoinFlow.mandateId
      );
    }

    return joinFlow;
  }
}

import {
  createQueryBuilder,
  FindConditions,
  FindManyOptions,
  FindOneOptions,
  getRepository
} from "typeorm";

import { log as mainLogger } from "@core/logging";
import {
  cleanEmailAddress,
  ContributionType,
  isDuplicateIndex,
  PaymentForm
} from "@core/utils";
import { generateMemberCode } from "@core/utils/member";

import NewsletterService from "@core/services/NewsletterService";
import OptionsService from "@core/services/OptionsService";
import PaymentService from "@core/services/PaymentService";

import Member from "@models/Member";
import MemberProfile from "@models/MemberProfile";
import MemberPermission, { PermissionType } from "@models/MemberPermission";

import DuplicateEmailError from "@api/errors/DuplicateEmailError";

export type PartialMember = Pick<Member, "email" | "contributionType"> &
  Partial<Member>;

const log = mainLogger.child({ app: "members-service" });

class MembersService {
  async find(options?: FindManyOptions<Member>): Promise<Member[]> {
    return await getRepository(Member).find(options);
  }

  async findByIds(
    ids: string[],
    options?: FindOneOptions<Member>
  ): Promise<Member[]> {
    return await getRepository(Member).findByIds(ids, options);
  }

  async findOne(
    id?: string,
    options?: FindOneOptions<Member>
  ): Promise<Member | undefined>;
  async findOne(options?: FindOneOptions<Member>): Promise<Member | undefined>;
  async findOne(
    conditions: FindConditions<Member>,
    options?: FindOneOptions<Member>
  ): Promise<Member | undefined>;
  async findOne(
    arg1?: string | FindConditions<Member> | FindOneOptions<Member>,
    arg2?: FindOneOptions<Member>
  ): Promise<Member | undefined> {
    return await getRepository(Member).findOne(arg1 as any, arg2);
  }

  async findByLoginOverride(code: string): Promise<Member | undefined> {
    return await createQueryBuilder(Member, "m")
      .where("m.loginOverride ->> 'code' = :code", { code: code })
      .andWhere("m.loginOverride ->> 'expires' > :now", { now: new Date() })
      .getOne();
  }

  async createMember(
    partialMember: Partial<Member> & {
      email: string;
      contributionType: ContributionType;
    },
    partialProfile: Partial<MemberProfile> = {},
    opts = { sync: true }
  ): Promise<Member> {
    log.info("Create member", { partialMember, partialProfile });

    try {
      const member = getRepository(Member).create({
        referralCode: generateMemberCode(partialMember),
        pollsCode: generateMemberCode(partialMember),
        permissions: [],
        password: { hash: "", salt: "", iterations: 0, tries: 0 },
        firstname: "",
        lastname: "",
        ...partialMember,
        email: cleanEmailAddress(partialMember.email)
      });
      await getRepository(Member).save(member);

      member.profile = getRepository(MemberProfile).create({
        ...partialProfile,
        member
      });
      await getRepository(MemberProfile).save(member.profile);

      if (opts.sync) {
        await NewsletterService.upsertMember(member);
      }

      return member;
    } catch (error) {
      if (isDuplicateIndex(error, "email")) {
        throw new DuplicateEmailError();
      } else if (
        isDuplicateIndex(error, "referralCode") ||
        isDuplicateIndex(error, "pollsCode")
      ) {
        return await this.createMember(partialMember, partialProfile, opts);
      }
      throw error;
    }
  }

  async updateMember(
    member: Member,
    updates: Partial<Member>,
    opts = { sync: true }
  ): Promise<void> {
    log.info("Update member " + member.id, {
      memberId: member.id,
      updates
    });

    if (updates.email) {
      updates.email = cleanEmailAddress(updates.email);
    }

    const oldEmail = updates.email && member.email;

    Object.assign(member, updates);
    try {
      await getRepository(Member).update(member.id, updates);
    } catch (err) {
      throw isDuplicateIndex(err, "email") ? new DuplicateEmailError() : err;
    }

    if (opts.sync) {
      await NewsletterService.upsertMember(member, updates, oldEmail);
    }

    await PaymentService.updateMember(member, updates);
  }

  async updateMemberPermission(
    member: Member,
    permission: PermissionType,
    updates?: Partial<Omit<MemberPermission, "member" | "permission">>
  ): Promise<void> {
    log.info(`Update permission ${permission} for ${member.id}`, updates);

    const wasActive = member.membership?.isActive;

    const existingPermission = member.permissions.find(
      (p) => p.permission === permission
    );
    if (existingPermission && updates) {
      Object.assign(existingPermission, updates);
    } else {
      const newPermission = getRepository(MemberPermission).create({
        member,
        permission,
        ...updates
      });
      member.permissions.push(newPermission);
    }
    await getRepository(Member).save(member);

    if (!wasActive && member.membership?.isActive) {
      await NewsletterService.addTagToMembers(
        [member],
        OptionsService.getText("newsletter-active-member-tag")
      );
    } else if (wasActive && !member.membership.isActive) {
      await NewsletterService.removeTagFromMembers(
        [member],
        OptionsService.getText("newsletter-active-member-tag")
      );
    }
  }

  async extendMemberPermission(
    member: Member,
    permission: PermissionType,
    dateExpires: Date
  ): Promise<void> {
    const p = member.permissions.find((p) => p.permission === permission);
    log.info(`Extend permission ${permission} for ${member.id}`, {
      memberId: member.id,
      permission,
      prevDate: p?.dateExpires,
      newDate: dateExpires
    });
    if (!p?.dateExpires || dateExpires > p.dateExpires) {
      await this.updateMemberPermission(member, permission, { dateExpires });
    }
  }

  async revokeMemberPermission(
    member: Member,
    permission: PermissionType
  ): Promise<void> {
    log.info(`Revoke permission ${permission} for ${member.id}`);
    member.permissions = member.permissions.filter(
      (p) => p.permission !== permission
    );
    await getRepository(MemberPermission).delete({ member, permission });

    if (!member.membership?.isActive) {
      await NewsletterService.removeTagFromMembers(
        [member],
        OptionsService.getText("newsletter-active-member-tag")
      );
    }
  }

  async updateMemberProfile(
    member: Member,
    updates: Partial<MemberProfile>,
    opts = { sync: true }
  ): Promise<void> {
    log.info("Update member profile for " + member.id);
    await getRepository(MemberProfile).update(member.id, updates);

    if (member.profile) {
      Object.assign(member.profile, updates);
    }

    if (opts.sync && (updates.newsletterStatus || updates.newsletterGroups)) {
      await NewsletterService.upsertMember(member);
    }
  }

  async updateMemberContribution(
    member: Member,
    paymentForm: PaymentForm
  ): Promise<void> {
    const { startNow, expiryDate } = await PaymentService.updateContribution(
      member,
      paymentForm
    );

    await this.updateMember(member, {
      contributionType: ContributionType.Automatic,
      contributionPeriod: paymentForm.period,
      ...(startNow
        ? {
            contributionMonthlyAmount: paymentForm.monthlyAmount,
            nextContributionMonthlyAmount: null
          }
        : {
            nextContributionMonthlyAmount: paymentForm.monthlyAmount
          })
    });

    await this.extendMemberPermission(member, "member", expiryDate);
  }

  async cancelMemberContribution(member: Member): Promise<void> {
    await PaymentService.cancelContribution(member);
    await this.updateMember(member, {
      nextContributionMonthlyAmount: null
    });
  }

  async permanentlyDeleteMember(member: Member): Promise<void> {
    await getRepository(Member).delete(member.id);
    await NewsletterService.deleteMembers([member]);
  }
}

export default new MembersService();

import { Request, Response } from "express";
import {
  createQueryBuilder,
  FindConditions,
  FindManyOptions,
  FindOneOptions,
  getRepository
} from "typeorm";

import gocardless from "@core/lib/gocardless";
import { log as mainLogger } from "@core/logging";
import { cleanEmailAddress, isDuplicateIndex } from "@core/utils";
import { AuthenticationStatus, canAdmin, generateCode } from "@core/utils/auth";

import EmailService from "@core/services/EmailService";
import NewsletterService from "@core/services/NewsletterService";
import OptionsService from "@core/services/OptionsService";

import GCPaymentData from "@models/GCPaymentData";
import Member from "@models/Member";
import MemberProfile from "@models/MemberProfile";
import MemberPermission, { PermissionType } from "@models/MemberPermission";

import config from "@config";

export type PartialMember = Pick<
  Member,
  "email" | "firstname" | "lastname" | "contributionType"
> &
  Partial<Member>;
export type PartialMemberProfile = Partial<MemberProfile>;

interface CreateMemberOpts {
  sync?: boolean;
}

const log = mainLogger.child({ app: "members-service" });

export default class MembersService {
  static generateMemberCode(
    member: Pick<Member, "firstname" | "lastname">
  ): string | undefined {
    if (member.firstname && member.lastname) {
      const no = ("000" + Math.floor(Math.random() * 1000)).slice(-3);
      return (member.firstname[0] + member.lastname[0] + no).toUpperCase();
    }
  }

  static async find(options?: FindManyOptions<Member>): Promise<Member[]> {
    return await getRepository(Member).find(options);
  }

  static async findByIds(
    ids: string[],
    options?: FindOneOptions<Member>
  ): Promise<Member[]> {
    return await getRepository(Member).findByIds(ids, options);
  }

  static async findOne(
    id?: string,
    options?: FindOneOptions<Member>
  ): Promise<Member | undefined>;
  static async findOne(
    options?: FindOneOptions<Member>
  ): Promise<Member | undefined>;
  static async findOne(
    conditions: FindConditions<Member>,
    options?: FindOneOptions<Member>
  ): Promise<Member | undefined>;
  static async findOne(
    arg1?: string | FindConditions<Member> | FindOneOptions<Member>,
    arg2?: FindOneOptions<Member>
  ): Promise<Member | undefined> {
    return await getRepository(Member).findOne(arg1 as any, arg2);
  }

  static async findByLoginOverride(code: string): Promise<Member | undefined> {
    return await createQueryBuilder(Member, "m")
      .where("m.loginOverride ->> 'code' = :code", { code: code })
      .andWhere("m.loginOverride ->> 'expires' > :now", { now: new Date() })
      .getOne();
  }

  static async createMember(
    partialMember: PartialMember,
    partialProfile: PartialMemberProfile = {},
    opts: CreateMemberOpts = { sync: true }
  ): Promise<Member> {
    log.info("Create member", { partialMember, partialProfile });

    try {
      const member = getRepository(Member).create({
        referralCode: this.generateMemberCode(partialMember),
        pollsCode: this.generateMemberCode(partialMember),
        permissions: [],
        password: { hash: "", salt: "", iterations: 0, tries: 0 },
        ...partialMember,
        email: cleanEmailAddress(partialMember.email)
      });
      await getRepository(Member).save(member);

      member.profile = getRepository(MemberProfile).create({
        ...partialProfile,
        member
      });
      await getRepository(MemberProfile).save(member.profile);

      if (opts?.sync) {
        await NewsletterService.upsertMembers([member]);
      }

      return member;
    } catch (error) {
      if (
        isDuplicateIndex(error, "referralCode") ||
        isDuplicateIndex(error, "pollsCode")
      ) {
        return await MembersService.createMember(
          partialMember,
          partialProfile,
          opts
        );
      }
      throw error;
    }
  }

  static async updateMember(
    member: Member,
    updates: Partial<Member>
  ): Promise<void> {
    log.info("Update member " + member.id, {
      memberId: member.id,
      updates
    });

    const oldEmail = updates.email && member.email;

    Object.assign(member, updates);
    await getRepository(Member).update(member.id, updates);

    await NewsletterService.updateMemberIfNeeded(member, updates, oldEmail);

    // TODO: This should be in GCPaymentService
    if (updates.email || updates.firstname || updates.lastname) {
      const gcData = await getRepository(GCPaymentData).findOne({ member });
      if (gcData && gcData.customerId) {
        log.info("Update member in GoCardless");
        await gocardless.customers.update(gcData.customerId, {
          ...(updates.email && { email: updates.email }),
          ...(updates.firstname && { given_name: updates.firstname }),
          ...(updates.lastname && { family_name: updates.lastname })
        });
      }
    }
  }

  static async updateMemberPermission(
    member: Member,
    permission: PermissionType,
    updates?: Partial<Omit<MemberPermission, "member" | "permission">>
  ): Promise<void> {
    log.info(`Update permission ${permission} for ${member.id}`, updates);

    const wasActive = member.isActiveMember;

    const existingPermission = member.permissions.find(
      (p) => p.permission === permission
    );
    if (existingPermission && updates) {
      Object.assign(existingPermission, updates);
      // TODO: temporary hack to force save undefined dateExpires
      if (
        Object.keys(updates).indexOf("dateExpires") > -1 &&
        !updates.dateExpires
      ) {
        existingPermission.dateExpires = null as any;
      }
    } else {
      const newPermission = getRepository(MemberPermission).create({
        member,
        permission,
        ...updates
      });
      member.permissions.push(newPermission);
    }
    await getRepository(Member).save(member);

    if (!wasActive && member.isActiveMember) {
      await NewsletterService.addTagToMembers(
        [member],
        OptionsService.getText("newsletter-active-member-tag")
      );
    } else if (wasActive && !member.isActiveMember) {
      await NewsletterService.removeTagFromMembers(
        [member],
        OptionsService.getText("newsletter-active-member-tag")
      );
    }
  }

  static async extendMemberPermission(
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
    if (!p || (p.dateExpires && dateExpires > p.dateExpires)) {
      await MembersService.updateMemberPermission(member, permission, {
        dateExpires
      });
    }
  }

  static async revokeMemberPermission(
    member: Member,
    permission: PermissionType
  ): Promise<void> {
    log.info(`Revoke permission ${permission} for ${member.id}`);
    member.permissions = member.permissions.filter(
      (p) => p.permission !== permission
    );
    await getRepository(MemberPermission).delete({ member, permission });

    if (!member.isActiveMember) {
      await NewsletterService.removeTagFromMembers(
        [member],
        OptionsService.getText("newsletter-active-member-tag")
      );
    }
  }

  static async updateMemberProfile(
    member: Member,
    updates: Partial<MemberProfile>,
    opts: CreateMemberOpts = { sync: true }
  ): Promise<void> {
    log.info("Update member profile for " + member.id);
    await getRepository(MemberProfile).update(member.id, updates);

    if (member.profile) {
      Object.assign(member.profile, updates);
    }

    if (opts?.sync && (updates.newsletterStatus || updates.newsletterGroups)) {
      if (!member.profile) {
        member.profile = await getRepository(MemberProfile).findOneOrFail({
          member
        });
      }
      await NewsletterService.upsertMembers([member]);
    }
  }

  static async resetMemberPassword(email: string): Promise<void> {
    const member = await getRepository(Member).findOne({ email });
    if (member) {
      member.password.resetCode = generateCode();
      await getRepository(Member).save(member);
      await EmailService.sendTemplateToMember("reset-password", member, {
        rpLink:
          config.audience + "/password-reset/code/" + member.password.resetCode
      });
    }
  }

  static loginAndRedirect(
    req: Request,
    res: Response,
    member: Member,
    url?: string
  ): void {
    req.login(member as Express.User, function (loginError) {
      if (loginError) {
        throw loginError;
      } else {
        if (!url) {
          url = OptionsService.getText(
            canAdmin(req) === AuthenticationStatus.LOGGED_IN
              ? "admin-home-url"
              : "user-home-url"
          );
        }
        res.redirect(url);
      }
    });
  }

  static async permanentlyDeleteMember(member: Member): Promise<void> {
    await getRepository(Member).delete(member.id);
    await NewsletterService.deleteMembers([member]);
  }
}

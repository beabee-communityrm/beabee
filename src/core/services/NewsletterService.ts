import { log as mainLogger } from "@core/logging";

import {
  NewsletterMember,
  NewsletterProvider,
  NewsletterStatus,
  UpdateNewsletterMember
} from "@core/providers/newsletter";
import MailchimpProvider from "@core/providers/newsletter/MailchimpProvider";
import NoneProvider from "@core/providers/newsletter/NoneProvider";

import Member from "@models/Member";

import config from "@config";
import { getRepository } from "typeorm";
import MemberProfile from "@models/MemberProfile";

const log = mainLogger.child({ app: "newsletter-service" });

function shouldUpdate(updates: Partial<Member>): boolean {
  return !!(
    updates.email ||
    updates.firstname ||
    updates.lastname ||
    updates.referralCode ||
    updates.pollsCode ||
    updates.contributionPeriod ||
    updates.contributionMonthlyAmount
  );
}

async function memberToNlUpdate(
  member: Member
): Promise<UpdateNewsletterMember | undefined> {
  // TODO: Fix that it relies on member.profile being loaded
  if (!member.profile) {
    member.profile = await getRepository(MemberProfile).findOneOrFail({
      member
    });
  }

  if (member.profile.newsletterStatus !== NewsletterStatus.None) {
    return {
      email: member.email,
      status: member.profile.newsletterStatus,
      groups: member.profile.newsletterGroups,
      firstname: member.firstname,
      lastname: member.lastname,
      fields: {
        REFCODE: member.referralCode || "",
        POLLSCODE: member.pollsCode || "",
        C_DESC: member.contributionDescription,
        C_MNTHAMT: member.contributionMonthlyAmount?.toString() || "",
        C_PERIOD: member.contributionPeriod || ""
      }
    };
  }
}

async function getValidMembers(
  members: Member[]
): Promise<UpdateNewsletterMember[]> {
  const nlMembers: UpdateNewsletterMember[] = [];
  for (const member of members) {
    const nlMember = await memberToNlUpdate(member);
    if (nlMember) {
      nlMembers.push(nlMember);
    }
  }
  return nlMembers;
}

class NewsletterService {
  private readonly provider: NewsletterProvider =
    config.newsletter.provider === "mailchimp"
      ? new MailchimpProvider(config.newsletter.settings)
      : new NoneProvider();

  async addTagToMembers(members: Member[], tag: string): Promise<void> {
    log.info(`Add tag ${tag} to ${members.length} members`);
    await this.provider.addTagToMembers(
      (await getValidMembers(members)).map((m) => m.email),
      tag
    );
  }

  async removeTagFromMembers(members: Member[], tag: string): Promise<void> {
    log.info(`Remove tag ${tag} from ${members.length} members`);
    await this.provider.removeTagFromMembers(
      (await getValidMembers(members)).map((m) => m.email),
      tag
    );
  }

  async upsertMember(
    member: Member,
    updates?: Partial<Member>,
    oldEmail?: string
  ): Promise<void> {
    const willUpdate = !updates || shouldUpdate(updates);

    if (willUpdate) {
      const nlMember = await memberToNlUpdate(member);
      if (nlMember) {
        log.info("Upsert member " + member.id);
        await this.provider.updateMember(nlMember, oldEmail);
      } else {
        log.info("Ignoring member update for " + member.id);
      }
    }
  }

  async upsertMembers(members: Member[]): Promise<void> {
    log.info(`Upsert ${members.length} members`);
    await this.provider.upsertMembers(await getValidMembers(members));
  }

  async updateMemberFields(
    member: Member,
    fields: Record<string, string>
  ): Promise<void> {
    log.info(`Update member fields for ${member.id}`, fields);
    await this.updateMembersFields([[member, fields]]);
  }

  async updateMembersFields(
    membersWithFields: [Member, Record<string, string>][]
  ): Promise<void> {
    log.info(`Update ${membersWithFields.length} members with fields`);

    const updates: UpdateNewsletterMember[] = [];
    for (const [member, fields] of membersWithFields) {
      const nlMember = await memberToNlUpdate(member);
      if (nlMember) {
        updates.push({
          email: nlMember.email,
          status: nlMember.status,
          fields
        });
      }
    }

    await this.provider.upsertMembers(updates);
  }

  async archiveMembers(members: Member[]): Promise<void> {
    log.info(`Archive ${members.length} members`);
    await this.provider.archiveMembers(
      (await getValidMembers(members)).map((m) => m.email)
    );
  }

  async deleteMembers(members: Member[]): Promise<void> {
    log.info(`Delete ${members.length} members`);
    await this.provider.deleteMembers(
      (await getValidMembers(members)).map((m) => m.email)
    );
  }

  async getNewsletterMember(
    email: string
  ): Promise<NewsletterMember | undefined> {
    return await this.provider.getMember(email);
  }

  async getNewsletterMembers(): Promise<NewsletterMember[]> {
    return await this.provider.getMembers();
  }
}

export default new NewsletterService();

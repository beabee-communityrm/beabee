import { log as mainLogger } from "@core/logging";

import {
  NewsletterMember,
  NewsletterProvider,
  PartialNewsletterMember
} from "@core/providers/newsletter";
import MailchimpProvider from "@core/providers/newsletter/MailchimpProvider";
import NoneProvider from "@core/providers/newsletter/NoneProvider";

import Member from "@models/Member";

import config from "@config";

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

function memberToNlMember(member: Member): PartialNewsletterMember {
  return {
    email: member.email,
    firstname: member.firstname,
    lastname: member.lastname,
    fields: {
      REFCODE: member.referralCode || "",
      POLLSCODE: member.pollsCode || "",
      C_DESC: member.contributionDescription,
      C_MNTHAMT: member.contributionMonthlyAmount?.toString() || "",
      C_PERIOD: member.contributionPeriod || ""
    },
    ...(member.profile && {
      status: member.profile.newsletterStatus,
      groups: member.profile.newsletterGroups
    })
  };
}

class NewsletterService {
  private readonly provider: NewsletterProvider =
    config.newsletter.provider === "mailchimp"
      ? new MailchimpProvider(config.newsletter.settings)
      : new NoneProvider();

  async addTagToMembers(members: Member[], tag: string): Promise<void> {
    log.info(`Add tag ${tag} to ${members.length} members`);
    await this.provider.addTagToMembers(
      members.map((m) => m.email),
      tag
    );
  }

  async removeTagFromMembers(members: Member[], tag: string): Promise<void> {
    log.info(`Remove tag ${tag} from ${members.length} members`);
    await this.provider.removeTagFromMembers(
      members.map((m) => m.email),
      tag
    );
  }

  async updateMemberIfNeeded(
    member: Member,
    updates: Partial<Member>,
    oldEmail?: string
  ): Promise<void> {
    const willUpdate = shouldUpdate(updates);
    if (willUpdate) {
      log.info("Update member " + member.id);
      await this.provider.updateMember(memberToNlMember(member), oldEmail);
    } else {
      log.info("Ignoring member update for " + member.id);
    }
  }

  async upsertMembers(members: Member[]): Promise<void> {
    log.info(`Upsert ${members.length} members`);
    await this.provider.upsertMembers(members.map(memberToNlMember));
  }

  async updateMemberFields(
    member: Member,
    fields: Record<string, string>
  ): Promise<void> {
    log.info(`Update member fields for ${member.id}`, fields);
    await this.provider.updateMember({ email: member.email, fields });
  }

  async archiveMembers(members: Member[]): Promise<void> {
    log.info(`Archive ${members.length} members`);
    await this.provider.archiveMembers(members.map((m) => m.email));
  }

  async deleteMembers(members: Member[]): Promise<void> {
    log.info(`Delete ${members.length} members`);
    await this.provider.deleteMembers(members.map((m) => m.email));
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

import { NewsletterStatus } from "@beabee/beabee-common";
import { log as mainLogger } from "@core/logging";

import {
  NewsletterMember,
  NewsletterProvider,
  UpdateNewsletterMember
} from "@core/providers/newsletter";
import MailchimpProvider from "@core/providers/newsletter/MailchimpProvider";
import NoneProvider from "@core/providers/newsletter/NoneProvider";

import Contact from "@models/Contact";

import config from "@config";
import { getRepository } from "typeorm";
import ContactProfile from "@models/ContactProfile";

const log = mainLogger.child({ app: "newsletter-service" });

function shouldUpdate(updates: Partial<Contact>): boolean {
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

async function contactToNlUpdate(
  contact: Contact
): Promise<UpdateNewsletterMember | undefined> {
  // TODO: Fix that it relies on contact.profile being loaded
  if (!contact.profile) {
    contact.profile = await getRepository(ContactProfile).findOneOrFail({
      member: contact
    });
  }

  if (contact.profile.newsletterStatus !== NewsletterStatus.None) {
    return {
      email: contact.email,
      status: contact.profile.newsletterStatus,
      groups: contact.profile.newsletterGroups,
      firstname: contact.firstname,
      lastname: contact.lastname,
      fields: {
        REFCODE: contact.referralCode || "",
        POLLSCODE: contact.pollsCode || "",
        C_DESC: contact.contributionDescription,
        C_MNTHAMT: contact.contributionMonthlyAmount?.toString() || "",
        C_PERIOD: contact.contributionPeriod || ""
      }
    };
  }
}

async function getValidNlUpdates(
  contacts: Contact[]
): Promise<UpdateNewsletterMember[]> {
  const nlUpdates = [];
  for (const contact of contacts) {
    const nlUpdate = await contactToNlUpdate(contact);
    if (nlUpdate) {
      nlUpdates.push(nlUpdate);
    }
  }
  return nlUpdates;
}

class NewsletterService {
  private readonly provider: NewsletterProvider =
    config.newsletter.provider === "mailchimp"
      ? new MailchimpProvider(config.newsletter.settings)
      : new NoneProvider();

  async addTagToContacts(contacts: Contact[], tag: string): Promise<void> {
    log.info(`Add tag ${tag} to ${contacts.length} contacts`);
    await this.provider.addTagToMembers(
      (await getValidNlUpdates(contacts)).map((m) => m.email),
      tag
    );
  }

  async removeTagFromContacts(contacts: Contact[], tag: string): Promise<void> {
    log.info(`Remove tag ${tag} from ${contacts.length} contacts`);
    await this.provider.removeTagFromMembers(
      (await getValidNlUpdates(contacts)).map((m) => m.email),
      tag
    );
  }

  async upsertContact(
    contact: Contact,
    updates?: Partial<Contact>,
    oldEmail?: string
  ): Promise<void> {
    const willUpdate = !updates || shouldUpdate(updates);

    if (willUpdate) {
      const nlUpdate = await contactToNlUpdate(contact);
      if (nlUpdate) {
        log.info("Upsert contact " + contact.id);
        await this.provider.updateMember(nlUpdate, oldEmail);
      } else {
        log.info("Ignoring contact update for " + contact.id);
      }
    }
  }

  async upsertContacts(contacts: Contact[]): Promise<void> {
    log.info(`Upsert ${contacts.length} contacts`);
    await this.provider.upsertMembers(await getValidNlUpdates(contacts));
  }

  async updateContactFields(
    contact: Contact,
    fields: Record<string, string>
  ): Promise<void> {
    log.info(`Update contact fields for ${contact.id}`, fields);
    const nlMember = await contactToNlUpdate(contact);
    if (nlMember) {
      await this.provider.updateMember({
        email: nlMember.email,
        status: nlMember.status,
        fields
      });
    } else {
      log.info("Ignoring contact field update for " + contact.id);
    }
  }

  async archiveContacts(contacts: Contact[]): Promise<void> {
    log.info(`Archive ${contacts.length} contacts`);
    await this.provider.archiveMembers(
      (await getValidNlUpdates(contacts)).map((m) => m.email)
    );
  }

  async deleteContacts(contacts: Contact[]): Promise<void> {
    log.info(`Delete ${contacts.length} contacts`);
    await this.provider.deleteMembers(
      (await getValidNlUpdates(contacts)).map((m) => m.email)
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

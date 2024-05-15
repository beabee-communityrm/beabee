import { NewsletterStatus } from "@beabee/beabee-common";

import { getRepository } from "@core/database";
import { log as mainLogger } from "@core/logging";

import {
  NewsletterContact,
  NewsletterProvider,
  UpdateNewsletterContact
} from "@core/providers/newsletter";
import MailchimpProvider from "@core/providers/newsletter/MailchimpProvider";
import NoneProvider from "@core/providers/newsletter/NoneProvider";

import Contact from "@models/Contact";
import ContactContribution from "@models/ContactContribution";
import ContactProfile from "@models/ContactProfile";

import config from "@config";

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
): Promise<UpdateNewsletterContact | undefined> {
  // TODO: Fix that it relies on contact.profile being loaded
  if (!contact.profile) {
    contact.profile = await getRepository(ContactProfile).findOneByOrFail({
      contactId: contact.id
    });
  }

  // TODO: Fix that it relies on contact.contribution being loaded
  if (!contact.contribution) {
    contact.contribution = await getRepository(
      ContactContribution
    ).findOneByOrFail({
      contactId: contact.id
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
        C_DESC: contact.contribution.description,
        C_MNTHAMT: contact.contribution.monthlyAmount?.toFixed(2) || "",
        C_PERIOD: contact.contribution.period || ""
      }
    };
  }
}

async function getValidNlUpdates(
  contacts: Contact[]
): Promise<UpdateNewsletterContact[]> {
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
    await this.provider.addTagToContacts(
      (await getValidNlUpdates(contacts)).map((m) => m.email),
      tag
    );
  }

  async removeTagFromContacts(contacts: Contact[], tag: string): Promise<void> {
    log.info(`Remove tag ${tag} from ${contacts.length} contacts`);
    await this.provider.removeTagFromContacts(
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
        await this.provider.updateContact(nlUpdate, oldEmail);
      } else {
        log.info("Ignoring contact update for " + contact.id);
      }
    }
  }

  async upsertContacts(contacts: Contact[]): Promise<void> {
    log.info(`Upsert ${contacts.length} contacts`);
    await this.provider.upsertContacts(await getValidNlUpdates(contacts));
  }

  async updateContactFields(
    contact: Contact,
    fields: Record<string, string>
  ): Promise<void> {
    log.info(`Update contact fields for ${contact.id}`, fields);
    const nlUpdate = await contactToNlUpdate(contact);
    if (nlUpdate) {
      await this.provider.updateContact({
        email: nlUpdate.email,
        status: nlUpdate.status,
        fields
      });
    } else {
      log.info("Ignoring contact field update for " + contact.id);
    }
  }

  async archiveContacts(contacts: Contact[]): Promise<void> {
    log.info(`Archive ${contacts.length} contacts`);
    await this.provider.archiveContacts(
      (await getValidNlUpdates(contacts)).map((m) => m.email)
    );
  }

  async deleteContacts(contacts: Contact[]): Promise<void> {
    log.info(`Delete ${contacts.length} contacts`);
    await this.provider.deleteContacts(
      (await getValidNlUpdates(contacts)).map((m) => m.email)
    );
  }

  async getNewsletterContact(
    email: string
  ): Promise<NewsletterContact | undefined> {
    return await this.provider.getContact(email);
  }

  async getNewsletterContacts(): Promise<NewsletterContact[]> {
    return await this.provider.getContacts();
  }
}

export default new NewsletterService();

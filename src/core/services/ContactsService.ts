import {
  ContributionType,
  RoleType,
  ContributionPeriod,
  NewsletterStatus
} from "@beabee/beabee-common";
import {
  createQueryBuilder,
  FindConditions,
  FindManyOptions,
  FindOneOptions,
  getRepository
} from "typeorm";

import { log as mainLogger } from "@core/logging";
import { cleanEmailAddress, isDuplicateIndex, PaymentForm } from "@core/utils";
import { generateContactCode } from "@core/utils/contact";

import EmailService from "@core/services/EmailService";
import NewsletterService from "@core/services/NewsletterService";
import OptionsService from "@core/services/OptionsService";
import PaymentService from "@core/services/PaymentService";

import Contact from "@models/Contact";
import ContactProfile from "@models/ContactProfile";
import ContactRole from "@models/ContactRole";

import DuplicateEmailError from "@api/errors/DuplicateEmailError";
import CantUpdateContribution from "@api/errors/CantUpdateContribution";

export type PartialContact = Pick<Contact, "email" | "contributionType"> &
  Partial<Contact>;

interface ForceUpdateContribution {
  type: ContributionType.Manual | ContributionType.None;
  period?: ContributionPeriod;
  amount?: number;
  source?: string;
  reference?: string;
}

const log = mainLogger.child({ app: "contacts-service" });

class ContactsService {
  async find(options?: FindManyOptions<Contact>): Promise<Contact[]> {
    return await getRepository(Contact).find(options);
  }

  async findByIds(
    ids: string[],
    options?: FindOneOptions<Contact>
  ): Promise<Contact[]> {
    return await getRepository(Contact).findByIds(ids, options);
  }

  async findOne(
    id?: string,
    options?: FindOneOptions<Contact>
  ): Promise<Contact | undefined>;
  async findOne(
    options?: FindOneOptions<Contact>
  ): Promise<Contact | undefined>;
  async findOne(
    conditions: FindConditions<Contact>,
    options?: FindOneOptions<Contact>
  ): Promise<Contact | undefined>;
  async findOne(
    arg1?: string | FindConditions<Contact> | FindOneOptions<Contact>,
    arg2?: FindOneOptions<Contact>
  ): Promise<Contact | undefined> {
    return await getRepository(Contact).findOne(arg1 as any, arg2);
  }

  async findByLoginOverride(code: string): Promise<Contact | undefined> {
    return await createQueryBuilder(Contact, "m")
      .where("m.loginOverride ->> 'code' = :code", { code: code })
      .andWhere("m.loginOverride ->> 'expires' > :now", { now: new Date() })
      .getOne();
  }

  async createContact(
    partialContact: Partial<Contact> & Pick<Contact, "email">,
    partialProfile: Partial<ContactProfile> = {},
    opts = { sync: true }
  ): Promise<Contact> {
    log.info("Create contact", { partialContact, partialProfile });

    try {
      const contact = getRepository(Contact).create({
        referralCode: generateContactCode(partialContact),
        pollsCode: generateContactCode(partialContact),
        roles: [],
        password: { hash: "", salt: "", iterations: 0, tries: 0 },
        firstname: "",
        lastname: "",
        contributionType: ContributionType.None,
        ...partialContact,
        email: cleanEmailAddress(partialContact.email)
      });
      await getRepository(Contact).save(contact);

      contact.profile = getRepository(ContactProfile).create({
        ...partialProfile,
        contact: contact
      });
      await getRepository(ContactProfile).save(contact.profile);

      await PaymentService.createContact(contact);

      if (opts.sync) {
        await NewsletterService.upsertContact(contact);
      }

      await EmailService.sendTemplateToAdmin("new-member", { contact });

      return contact;
    } catch (error) {
      if (isDuplicateIndex(error, "email")) {
        throw new DuplicateEmailError();
      } else if (
        isDuplicateIndex(error, "referralCode") ||
        isDuplicateIndex(error, "pollsCode")
      ) {
        return await this.createContact(partialContact, partialProfile, opts);
      }
      throw error;
    }
  }

  /**
   * Update a contact, syncing with the payment service and optionally the
   * newsletter service
   *
   * @param contact The contact to update
   * @param updates The updates to apply to the contact
   * @param opts Options for the update
   */
  async updateContact(
    contact: Contact,
    updates: Partial<Contact>,
    opts = { sync: true }
  ): Promise<void> {
    log.info("Update contact " + contact.id, {
      contactId: contact.id,
      updates
    });

    if (updates.email) {
      updates.email = cleanEmailAddress(updates.email);
    }

    const oldEmail = updates.email && contact.email;

    Object.assign(contact, updates);
    try {
      await getRepository(Contact).update(contact.id, updates);
    } catch (err) {
      throw isDuplicateIndex(err, "email") ? new DuplicateEmailError() : err;
    }

    if (opts.sync) {
      await NewsletterService.upsertContact(contact, updates, oldEmail);
    }

    await PaymentService.updateContact(contact, updates);
  }

  /**
   * Update a contact's role, creating it if it doesn't exist.
   * Also toggles the newsletter active member tag if needed.
   *
   * @param contact The contact to update the role for
   * @param roleType The role to update
   * @param updates The updates to apply to the role
   */
  async updateContactRole(
    contact: Contact,
    roleType: RoleType,
    updates: { dateAdded?: Date; dateExpires?: Date | null }
  ): Promise<ContactRole> {
    log.info(`Update role ${roleType} for ${contact.id}`, updates);

    const wasActive = contact.membership?.isActive;

    let role = contact.roles.find((p) => p.type === roleType);
    if (role) {
      role.dateAdded = updates.dateAdded || role.dateAdded;
      role.dateExpires = updates.dateExpires || role.dateExpires;
    } else {
      role = getRepository(ContactRole).create({
        contact: contact,
        type: roleType,
        dateAdded: updates?.dateAdded || new Date(),
        dateExpires: updates?.dateExpires || null
      });
      contact.roles.push(role);
    }

    await getRepository(Contact).save(contact);

    if (!wasActive && contact.membership?.isActive) {
      await NewsletterService.addTagToContacts(
        [contact],
        OptionsService.getText("newsletter-active-member-tag")
      );
    } else if (wasActive && !contact.membership.isActive) {
      await NewsletterService.removeTagFromContacts(
        [contact],
        OptionsService.getText("newsletter-active-member-tag")
      );
    }

    return role;
  }

  /**
   * Extend a contact's role if the new date is later than the current one, or
   * sets it if there is no current expiry date

   * @param contact The contact to extend the role for
   * @param roleType The role to extend
   * @param dateExpires The new date to extend the role to
   */
  async extendContactRole(
    contact: Contact,
    roleType: RoleType,
    dateExpires: Date
  ): Promise<void> {
    const p = contact.roles.find((p) => p.type === roleType);
    log.info(`Extend role ${roleType} for ${contact.id}`, {
      contactId: contact.id,
      role: roleType,
      prevDate: p?.dateExpires,
      newDate: dateExpires
    });
    if (!p?.dateExpires || dateExpires > p.dateExpires) {
      await this.updateContactRole(contact, roleType, { dateExpires });
    }
  }

  /**
   * Revoke a contact's role.
   *
   * @param contact The contact to revoke the role for
   * @param roleType The role to revoke
   */
  async revokeContactRole(
    contact: Contact,
    roleType: RoleType
  ): Promise<boolean> {
    log.info(`Revoke role ${roleType} for ${contact.id}`);
    contact.roles = contact.roles.filter((p) => p.type !== roleType);
    const ret = await getRepository(ContactRole).delete({
      contact: contact,
      type: roleType
    });

    if (!contact.membership?.isActive) {
      await NewsletterService.removeTagFromContacts(
        [contact],
        OptionsService.getText("newsletter-active-member-tag")
      );
    }

    return ret.affected !== 0;
  }

  async updateContactProfile(
    contact: Contact,
    updates: Partial<ContactProfile>,
    opts = { sync: true }
  ): Promise<void> {
    log.info("Update contact profile for " + contact.id, { updates });
    const shouldSync =
      opts.sync && (updates.newsletterStatus || updates.newsletterGroups);
    let isFirstSync = false;

    if (shouldSync) {
      contact.profile = await getRepository(ContactProfile).findOneOrFail({
        contact
      });
      // If this is the first time the contact is being synced to the newsletter
      // then we need to set the active member tag
      isFirstSync = contact.profile.newsletterStatus === NewsletterStatus.None;
    }

    await getRepository(ContactProfile).update(contact.id, updates);

    if (contact.profile) {
      Object.assign(contact.profile, updates);
    }

    if (shouldSync) {
      await NewsletterService.upsertContact(contact);
      // Add the active member tag
      if (isFirstSync && contact.membership?.isActive) {
        await NewsletterService.addTagToContacts(
          [contact],
          OptionsService.getText("newsletter-active-member-tag")
        );
      }
    }
  }

  async updateContactContribution(
    contact: Contact,
    paymentForm: PaymentForm
  ): Promise<void> {
    // At the moment the only possibility is to go from whatever contribution
    // type the user was before to an automatic contribution
    const wasManual = contact.contributionType === ContributionType.Manual;

    // Some period changes on active members aren't allowed at the moment to
    // prevent proration problems
    if (
      contact.membership?.isActive &&
      // Annual contributors can't change their period
      contact.contributionPeriod === ContributionPeriod.Annually &&
      paymentForm.period !== ContributionPeriod.Annually
    ) {
      throw new CantUpdateContribution();
    }

    const { startNow, expiryDate } = await PaymentService.updateContribution(
      contact,
      paymentForm
    );

    log.info("Updated contribution", { startNow, expiryDate });

    await this.updateContact(contact, {
      contributionType: ContributionType.Automatic,
      contributionPeriod: paymentForm.period,
      ...(startNow && {
        contributionMonthlyAmount: paymentForm.monthlyAmount
      })
    });

    await this.extendContactRole(contact, "member", expiryDate);

    if (wasManual) {
      await EmailService.sendTemplateToContact("manual-to-automatic", contact);
    }
  }

  async cancelContactContribution(
    contact: Contact,
    email: "cancelled-contribution" | "cancelled-contribution-no-survey"
  ): Promise<void> {
    await PaymentService.cancelContribution(contact);

    await EmailService.sendTemplateToContact(email, contact);
    await EmailService.sendTemplateToAdmin("cancelled-member", {
      contact: contact
    });
  }

  async permanentlyDeleteContact(contact: Contact): Promise<void> {
    await getRepository(Contact).delete(contact.id);
    await NewsletterService.deleteContacts([contact]);
  }

  // This is a temporary method until we rework manual contribution updates
  // TODO: Remove this!
  async forceUpdateContactContribution(
    contact: Contact,
    data: ForceUpdateContribution
  ): Promise<void> {
    if (contact.contributionType === ContributionType.Automatic) {
      throw new CantUpdateContribution();
    }

    const period = data.period && data.amount ? data.period : null;
    const monthlyAmount =
      data.period && data.amount
        ? data.amount / (data.period === ContributionPeriod.Annually ? 12 : 1)
        : null;

    await this.updateContact(contact, {
      contributionType: data.type,
      contributionPeriod: period,
      contributionMonthlyAmount: monthlyAmount
    });

    await PaymentService.updateDataBy(contact, "source", data.source || null);
    await PaymentService.updateDataBy(
      contact,
      "reference",
      data.reference || null
    );
  }
}

export default new ContactsService();

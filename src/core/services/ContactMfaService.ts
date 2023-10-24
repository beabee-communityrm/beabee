import { FindConditions, FindOneOptions, getRepository } from "typeorm";
import { TOTP, Secret } from "otpauth";

import Contact from "@models/Contact";
import ContactMfa from "@models/ContactMfa";

import { CreateContactMfaData } from "@api/data/ContactData/interface";

import contactService from "./ContactsService";

/**
 * Contact multi factor authentication service
 * TODO: @wpf500 How can I make sure that only the user itself get fetch its own mfa?
 */
class ContactMfaService {
  async findOne(
    id?: string,
    options?: FindOneOptions<Contact>
  ): Promise<ContactMfa | undefined>;
  async findOne(
    options?: FindOneOptions<Contact>
  ): Promise<ContactMfa | undefined>;
  async findOne(
    conditions: FindConditions<Contact>,
    options?: FindOneOptions<Contact>
  ): Promise<ContactMfa | undefined>;
  async findOne(
    arg1?: string | FindConditions<Contact> | FindOneOptions<Contact>,
    arg2?: FindOneOptions<Contact>
  ): Promise<ContactMfa | undefined> {
    const contact = await contactService.findOne(arg1 as any, arg2);
    if (!contact) {
      return;
    }
    const mfa = await getRepository(ContactMfa).findOne({ contact });
    return mfa;
  }

  async create(contact: Contact, data: CreateContactMfaData) {
    const isValid = this.validateToken(data);

    if (!isValid) {
      throw new Error("Invalid token");
    }

    const mfa = await getRepository(ContactMfa).save({
      contact,
      ...data
    });
    return mfa;
  }

  validateToken(mfa: CreateContactMfaData) {
    const totp = new TOTP({
      secret: Secret.fromBase32(mfa.secret)
    });

    const delta = totp.validate({ token: mfa.token });

    // To check if the authenticator works it should be enough to check if the token is max. two steps behind the current time
    // E.g. if the user needs longer to click on save, the token is still valid
    const isValid = delta !== null && delta <= 0 && delta >= -2;

    return isValid;
  }
}

export default new ContactMfaService();

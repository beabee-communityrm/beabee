import { FindConditions, FindOneOptions, getRepository } from "typeorm";
import { TOTP, Secret } from "otpauth";

import Contact from "@models/Contact";
import ContactMfa from "@models/ContactMfa";

import { CreateContactMfaData } from "@api/data/ContactData/interface";

/**
 * Contact multi factor authentication service
 */
class ContactMfaService {
  async get(contact: Contact): Promise<ContactMfa | undefined> {
    const mfa = await getRepository(ContactMfa).findOne(contact.id);
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

  async delete(contact: Contact) {
    const mfa = await this.get(contact);

    if (!mfa) {
      throw new Error("Contact has no MFA");
    }

    await getRepository(ContactMfa).delete({ contact: { id: contact.id } });
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

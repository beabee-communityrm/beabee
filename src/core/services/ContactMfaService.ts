import { getRepository } from "typeorm";
import { TOTP, Secret } from "otpauth";

import Contact from "@models/Contact";
import ContactMfa from "@models/ContactMfa";

import { CreateContactMfaData } from "@api/data/ContactData/interface";

/**
 * Contact multi factor authentication service
 */
class ContactMfaService {
  /**
   * Get contact MFA by contact
   * @param contact The contact
   * @returns
   */
  async get(contact: Contact): Promise<ContactMfa | undefined> {
    const mfa = await getRepository(ContactMfa).findOne({
      where: {
        contact: {
          id: contact.id
        }
      }
    });
    return mfa;
  }

  /**
   * Get contact MFA by MFA ID
   * @param id
   * @returns
   */
  async getById(id: string): Promise<ContactMfa | undefined> {
    const mfa = await getRepository(ContactMfa).findOne(id);
    return mfa;
  }

  /**
   * Create contact MFA
   * @param contact The contact
   * @param data The mfa data
   * @returns
   */
  async create(contact: Contact, data: CreateContactMfaData) {
    const isValid = this.validateToken(data.secret, data.token);

    if (!isValid) {
      throw new Error("Invalid token");
    }

    const mfa = await getRepository(ContactMfa).save({
      contact,
      ...data
    });
    return mfa;
  }

  /**
   * Delete contact MFA
   * @param contact The contact
   */
  async delete(contact: Contact) {
    const mfa = await this.get(contact);

    if (!mfa) {
      throw new Error("Contact has no MFA");
    }

    await getRepository(ContactMfa).delete(mfa.id);
  }

  /**
   * Validate 2FA TOTP token
   * @param secret The secret key encoded in base32
   * @param token The token to validate
   * @returns `true` if valid, `false` otherwise
   */
  validateToken(secret: string, token: string) {
    const totp = new TOTP({
      secret: Secret.fromBase32(secret)
    });

    const delta = totp.validate({ token });

    // To check if the authenticator works it should be enough to check if the token is max. two steps behind the current time
    // E.g. if the user needs longer to click on save, the token is still valid
    const isValid = delta !== null && delta <= 0 && delta >= -2;

    return isValid;
  }
}

export default new ContactMfaService();

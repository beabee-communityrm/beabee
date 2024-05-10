import { NotFoundError } from "routing-controllers";

import Contact from "@models/Contact";
import ContactMfa from "@models/ContactMfa";

import { getRepository } from "@core/database";
import { validateTotpToken } from "@core/utils/auth";

import { LOGIN_CODES } from "@enums/login-codes";

import BadRequestError from "@api/errors/BadRequestError";
import UnauthorizedError from "@api/errors/UnauthorizedError";

import { ContactMfaSecure } from "@type/contact-mfa-secure";
import { CreateContactMfaData } from "@type/create-contact-mfa-data";
import { DeleteContactMfaData } from "@type/delete-contact-mfa-data";

/**
 * Contact multi factor authentication service
 */
class ContactMfaService {
  /**
   * Get contact MFA by contact.
   * @param contact The contact
   * @returns The **secure** contact MFA without the `secret` key
   */
  async get(contact: Contact): Promise<ContactMfaSecure | null> {
    const mfa = await this.getInsecure(contact);
    return this.makeSecure(mfa);
  }

  /**
   * Get contact MFA by MFA ID.
   * @param id The MFA ID (not the contact ID)
   * @returns The **secure** contact MFA without the `secret` key
   */
  async getById(id: string): Promise<ContactMfaSecure | null> {
    const mfa = await this.getByIdInsecure(id);
    return this.makeSecure(mfa);
  }

  /**
   * Create contact MFA
   * @param contact The contact
   * @param data The mfa data
   * @returns
   */
  async create(contact: Contact, data: CreateContactMfaData) {
    // Validate the token to make sure the user has entered the correct token
    // For the creation we allow two steps behind the current time if the user is slow
    const { isValid } = validateTotpToken(data.secret, data.token, 2);

    if (!isValid) {
      throw new UnauthorizedError({ code: LOGIN_CODES.INVALID_TOKEN });
    }

    const mfa = await getRepository(ContactMfa).save({
      contact,
      ...data
    });
    return mfa;
  }

  /**
   * Delete contact MFA
   *
   * ### ATTENTION
   * This method is secure because the token is checked.
   *
   * @param contact The contact
   * @param data The MFA type and the token (if the user is not an admin)
   */
  async deleteSecure(contact: Contact, data: DeleteContactMfaData) {
    if (!data.token) {
      throw new BadRequestError({
        code: LOGIN_CODES.MISSING_TOKEN,
        message:
          "The contact itself needs to enter the old code to delete its MFA"
      });
    }
    const tokenValidation = await this.checkToken(contact, data.token, 2);
    if (!tokenValidation.isValid) {
      throw new UnauthorizedError({
        code: LOGIN_CODES.INVALID_TOKEN,
        message: "Invalid token"
      });
    }

    return this.deleteUnsecure(contact);
  }

  /**
   * Delete contact MFA
   *
   * ### ATTENTION
   * In this unsecure method the token is not checked. So calling this method is only allowed for admins.
   *
   * @param contact The contact
   * @param id The request contact ID (we check if the id is 'me' or the contact ID)
   * @param data The MFA type and the token (if the user is not an admin)
   */
  async deleteUnsecure(contact: Contact) {
    const mfa = await this.get(contact);

    if (!mfa) {
      throw new NotFoundError("Contact has no MFA");
    }

    await getRepository(ContactMfa).delete(mfa.id);
  }

  /**
   * Check if the MFA token is valid for the contact
   * @param contact The contact
   * @param token The user's token
   * @param window The larger this value is, the greater the time difference between the user and server that will be tolerated, but it also becomes increasingly less secure.
   * @returns
   */
  async checkToken(contact: Contact, token: string, window = 1) {
    const mfa = await this.getInsecure(contact);
    if (!mfa) {
      return {
        isValid: true,
        delta: null
      };
    }
    return validateTotpToken(mfa.secret, token, window);
  }

  /**
   * Permanently delete the MFA data for a contact
   * @param contact The contact
   */
  async permanentlyDeleteContact(contact: Contact): Promise<void> {
    await getRepository(ContactMfa).delete({ contactId: contact.id });
  }

  /**
   * Get contact MFA by contact.
   *
   * ### ATTENTION
   * This method is unsecure because it contains the `secret` key.
   * Please only use them if you know what you are doing.
   *
   * @param contact The contact
   * @returns The **insecure** contact MFA with the `secret` key
   */
  private async getInsecure(contact: Contact): Promise<ContactMfa | null> {
    const mfa = await getRepository(ContactMfa).findOneBy({
      contactId: contact.id
    });
    return mfa || null;
  }

  /**
   * Get contact MFA by MFA ID.
   *
   * ### ATTENTION
   * This method is unsecure because it contains the `secret` key.
   * Please only use them if you know what you are doing.
   *
   * @param id The MFA ID (not the contact ID)
   * @returns The **insecure** contact MFA with the `secret` key
   */
  private async getByIdInsecure(id: string): Promise<ContactMfa | null> {
    const mfa = await getRepository(ContactMfa).findOneBy({ id });
    return mfa || null;
  }

  /**
   * Make contact MFA secure by removing the secret key.
   * @param mfa
   * @returns
   */
  private makeSecure(
    mfa?: ContactMfa | null
  ): Pick<ContactMfa, "id" | "type"> | null {
    if (!mfa) {
      return null;
    }
    return {
      id: mfa.id,
      type: mfa.type
    };
  }
}

export default new ContactMfaService();

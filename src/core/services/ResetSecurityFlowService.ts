import { getRepository } from "typeorm";
import { BadRequestError, NotFoundError } from "routing-controllers";

import UnauthorizedError from "@api/errors/UnauthorizedError";

import { generatePassword } from "@core/utils/auth";

import ContactsService from "@core/services/ContactsService";
import EmailService from "@core/services/EmailService";
import AuthService from "@core/services/AuthService";
import ContactMfaService from "@core/services/ContactMfaService";

import ResetSecurityFlow from "@models/ResetSecurityFlow";
import Contact from "@models/Contact";

import {
  CreateResetPasswordData,
  UpdateResetPasswordData
} from "@api/data/ResetPasswordData";
import {
  CreateResetDeviceData,
  UpdateResetDeviceData
} from "@api/data/ResetDeviceData";

import { RESET_SECURITY_FLOW_TYPE } from "@enums/reset-security-flow-type";

/**
 * Service for handling reset password and reset device flows.
 */
class ResetSecurityFlowService {
  /**
   * Starts the reset password flow.
   * This is mostly used after the user has clicked on the forgot password the link on the login page.
   * @param data
   * @returns The contact associated with the reset device flow or null if the email doesn't exist
   */
  public async resetPasswordBegin(data: CreateResetPasswordData) {
    const contact = await ContactsService.findOne({ email: data.email });

    // We don't want to leak if the email exists or not
    if (!contact) {
      return null;
    }

    // TODO: Check if contact has already requested a reset device flow, if so throw error

    const rpFlow = await this.create(
      contact,
      RESET_SECURITY_FLOW_TYPE.PASSWORD
    );

    await EmailService.sendTemplateToContact("reset-password", contact, {
      rpLink: data.resetUrl + "/" + rpFlow.id
    });

    return contact;
  }

  /**
   * Completes the reset password flow.
   * This is mostly used after the user has clicked the link in the email.
   * @param id The reset password flow id
   * @param data
   * @returns The contact associated with the reset password flow
   */
  public async resetPasswordComplete(
    id: string,
    data: UpdateResetPasswordData
  ) {
    const rpFlow = await this.get(id);

    if (!rpFlow) {
      throw new NotFoundError();
    }

    if (rpFlow.type !== RESET_SECURITY_FLOW_TYPE.PASSWORD) {
      throw new BadRequestError();
    }

    // TODO: Check if contact has MFA enabled, if so validate MFA

    await ContactsService.updateContact(rpFlow.contact, {
      password: await generatePassword(data.password)
    });

    await this.delete(id);

    return rpFlow.contact;
  }

  /**
   * Starts the reset device flow.
   * This is mostly used after the user has clicked on the lost device the link on the login page.
   * @param data
   * @returns The contact associated with the reset device flow or null if the email doesn't exist
   */
  public async resetDeviceBegin(data: CreateResetDeviceData) {
    const contact = await ContactsService.findOne({ email: data.email });

    // We don't want to leak if the email exists or not
    if (!contact) {
      return null;
    }

    // TODO: Check if contact has MFA enabled

    // TODO: Check if reset password flow already exists, if so throw error

    const rpFlow = await this.create(contact, data.type);

    await EmailService.sendTemplateToContact("reset-device", contact, {
      rpLink: data.resetUrl + "/" + rpFlow.id
    });

    return contact;
  }

  /**
   * Completes the reset device flow.
   * This is mostly used after the user has clicked the link in the email.
   * @param id The reset device flow id
   * @param data
   * @returns The contact associated with the reset device flow
   */
  public async resetDeviceComplete(id: string, data: UpdateResetDeviceData) {
    const rpFlow = await this.get(id);

    if (!rpFlow) {
      throw new NotFoundError();
    }

    if (rpFlow.type !== RESET_SECURITY_FLOW_TYPE.TOTP) {
      throw new BadRequestError();
    }

    // Validate password
    const isValid = await AuthService.isValidPassword(
      rpFlow.contact.password,
      data.password
    );

    if (!isValid) {
      await ContactsService.incrementPasswordTries(rpFlow.contact);
      // TODO: Error codes
      throw new UnauthorizedError();
    }

    await ContactsService.resetPasswordTries(rpFlow.contact);

    // Disable MFA
    await ContactMfaService.deleteUnsecure(rpFlow.contact);

    // Stop reset flow
    await this.delete(id);

    return rpFlow.contact;
  }

  /**
   * Creates a reset security flow.
   * @param contact The contact
   * @param type The reset security flow type
   * @returns The reset security flow
   */
  private async create(contact: Contact, type: RESET_SECURITY_FLOW_TYPE) {
    return await getRepository(ResetSecurityFlow).save({ contact, type });
  }

  /**
   * Deletes a reset security flow.
   * @param id The reset security flow id
   */
  private async delete(id: string) {
    return await getRepository(ResetSecurityFlow).delete(id);
  }

  /**
   * Gets a reset security flow.
   * @param id The reset security flow id
   * @returns The reset security flow
   */
  private async get(id: string) {
    return await getRepository(ResetSecurityFlow).findOne({
      where: { id },
      relations: ["contact"]
    });
  }
}

export default new ResetSecurityFlowService();

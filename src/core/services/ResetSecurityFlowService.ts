import { getRepository } from "typeorm";

import UnauthorizedError from "@api/errors/UnauthorizedError";
import ForbiddenError from "@api/errors/ForbiddenError";
import NotFoundError from "@api/errors/NotFoundError";
import BadRequestError from "@api/errors/BadRequestError";

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
import { RESET_SECURITY_FLOW_ERROR_CODE } from "@enums/reset-security-flow-error-code";
import { CONTACT_MFA_TYPE } from "@enums/contact-mfa-type";

/**
 * Service for handling reset password and reset device flows.
 *
 * This service is oriented on the client side `ResetSecurityFlowService`.
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

    // Check if contact has already requested a reset device flow, if so throw error
    const rdFlow = await this.getByType(contact, RESET_SECURITY_FLOW_TYPE.TOTP);
    if (rdFlow) {
      throw new ForbiddenError({
        code: RESET_SECURITY_FLOW_ERROR_CODE.OTHER_ACTIVE_FLOW,
        message:
          "Contact has already requested a reset device flow, for security reasons please complete the reset password flow first"
      });
    }

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
      throw new NotFoundError({
        code: RESET_SECURITY_FLOW_ERROR_CODE.NOT_FOUND
      });
    }

    if (rpFlow.type !== RESET_SECURITY_FLOW_TYPE.PASSWORD) {
      throw new BadRequestError({
        code: RESET_SECURITY_FLOW_ERROR_CODE.WRONG_TYPE
      });
    }

    // Check if contact has MFA enabled, if so validate MFA
    const mfa = await ContactMfaService.get(rpFlow.contact);
    if (mfa) {
      // In the future, we might want to add more types of reset flows
      if (mfa.type !== CONTACT_MFA_TYPE.TOTP) {
        throw new BadRequestError({
          code: RESET_SECURITY_FLOW_ERROR_CODE.WRONG_MFA_TYPE
        });
      }

      if (!data.token) {
        throw new BadRequestError({
          code: RESET_SECURITY_FLOW_ERROR_CODE.INVALID_TOKEN
        });
      }

      const isValid = await ContactMfaService.checkToken(
        rpFlow.contact,
        data.token,
        1
      );

      if (!isValid) {
        throw new UnauthorizedError({
          code: RESET_SECURITY_FLOW_ERROR_CODE.INVALID_TOKEN
        });
      }
    }

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

    // Check if contact has MFA enabled
    const mfa = await ContactMfaService.get(contact);
    if (!mfa) {
      throw new BadRequestError({
        code: RESET_SECURITY_FLOW_ERROR_CODE.NO_MFA,
        message: "Contact has no MFA enabled"
      });
    }

    // Check if reset password flow already exists, if so throw error
    const rpFlow = await this.getByType(
      contact,
      RESET_SECURITY_FLOW_TYPE.PASSWORD
    );
    if (rpFlow) {
      throw new ForbiddenError({
        code: RESET_SECURITY_FLOW_ERROR_CODE.OTHER_ACTIVE_FLOW,
        message:
          "Contact has already requested a reset device flow, for security reasons please complete the reset password flow first"
      });
    }

    const rdFlow = await this.create(contact, data.type);

    await EmailService.sendTemplateToContact("reset-device", contact, {
      rpLink: data.resetUrl + "/" + rdFlow.id
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
    const rdFlow = await this.get(id);

    if (!rdFlow) {
      throw new NotFoundError({
        code: RESET_SECURITY_FLOW_ERROR_CODE.NOT_FOUND
      });
    }

    if (rdFlow.type !== RESET_SECURITY_FLOW_TYPE.TOTP) {
      throw new BadRequestError({
        code: RESET_SECURITY_FLOW_ERROR_CODE.WRONG_TYPE
      });
    }

    // Validate password
    const isValid = await AuthService.isValidPassword(
      rdFlow.contact.password,
      data.password
    );

    if (!isValid) {
      await ContactsService.incrementPasswordTries(rdFlow.contact);
      throw new UnauthorizedError({
        code: RESET_SECURITY_FLOW_ERROR_CODE.INVALID_PASSWORD
      });
    }

    // Reset password tries because the password was correct
    await ContactsService.resetPasswordTries(rdFlow.contact);

    // Disable MFA, we can use the unsecure method because we already validated the password
    await ContactMfaService.deleteUnsecure(rdFlow.contact);

    // Stop reset flow
    await this.delete(id);

    return rdFlow.contact;
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

  private async getByType(contact: Contact, type: RESET_SECURITY_FLOW_TYPE) {
    return await getRepository(ResetSecurityFlow).findOne({
      where: { contact, type }
    });
  }
}

export default new ResetSecurityFlowService();

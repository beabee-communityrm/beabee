import { sub } from "date-fns";
import { HttpError } from "routing-controllers";
import { MoreThan } from "typeorm";

import { getRepository } from "@core/database";

import Contact from "@models/Contact";
import UploadFlow from "@models/UploadFlow";

class UploadFlowService {
  /**
   * Create an upload flow for the given contact and IP address, checking that they
   * have not exceeded the rate limits.
   * @param contact The contact
   * @param ipAddress  The IP address
   * @returns
   */
  async create(
    contact: Contact | undefined,
    ipAddress: string
  ): Promise<string> {
    // No more than 10 uploads in a minute for all users
    const oneMinAgo = sub(new Date(), { minutes: 1 });
    await this.canUploadOrFail(ipAddress, oneMinAgo, 10);

    // No more than 20 uploads in an hour for non-authed users
    if (!contact) {
      const oneHourAgo = sub(new Date(), { hours: 1 });
      await this.canUploadOrFail(ipAddress, oneHourAgo, 20);
    }

    const newUploadFlow = await getRepository(UploadFlow).save({
      contact: contact || null,
      ipAddress,
      used: false
    });

    return newUploadFlow.id;
  }

  /**
   * Validate an upload flow ID, marking it as used if it is valid.
   * @param id The flow ID
   * @returns whether the flow was valid
   */
  async validate(id: string): Promise<boolean> {
    // Flows are valid for one minute
    const oneMinAgo = sub(new Date(), { minutes: 1 });

    // Both checks if the flow exists and set's it as used so it can only be used once
    const res = await getRepository(UploadFlow).update(
      { id, date: MoreThan(oneMinAgo), used: false },
      { used: true }
    );

    return !!res.affected;
  }

  /**
   * Permanently delete all upload flow data for a contact.
   * @param contact The contact
   */
  async permanentlyDeleteContact(contact: Contact): Promise<void> {
    await getRepository(UploadFlow).delete({ contactId: contact.id });
  }

  /**
   * Check if the given IP address has exceeded the rate limit for uploads.
   * @param ipAddress The IP address
   * @param date The date to check from
   * @param max The maximum number of uploads allowed
   */
  private async canUploadOrFail(ipAddress: string, date: Date, max: number) {
    const uploadFlows = await getRepository(UploadFlow).find({
      where: { ipAddress, date: MoreThan(date) }
    });
    if (uploadFlows.length >= max) {
      throw new HttpError(429, "Too many upload requests");
    }
  }
}

export default new UploadFlowService();

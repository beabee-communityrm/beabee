import { subHours } from "date-fns";
import { InsertResult, MoreThan, createQueryBuilder } from "typeorm";

import { getRepository } from "@core/database";

import ResetSecurityFlow from "@models/ResetSecurityFlow";
import Contact from "@models/Contact";

import { RESET_SECURITY_FLOW_TYPE } from "@enums/reset-security-flow-type";

interface InsertResetSecurityFlowResult extends InsertResult {
  raw: { id: string; contactId: string }[] | undefined;
}

/**
 * Service for handling reset password and reset device flows.
 *
 * This service is oriented on the client side `ResetSecurityFlowService`.
 */
class ResetSecurityFlowService {
  /**
   * Creates a reset security flow.
   * @param contact The contact
   * @param type The reset security flow type
   * @returns The reset security flow
   */
  async create(contact: Contact, type: RESET_SECURITY_FLOW_TYPE) {
    return await getRepository(ResetSecurityFlow).save({ contact, type });
  }

  /**
   * Creates multiple reset security flows efficiently using a single query
   *
   * @param contactIds A list of contact IDs to create reset security flows for
   * @param type The reset security flow type
   * @returns a map of contact IDs to reset security flow IDs
   */
  async createManyRaw(
    contactIds: string[],
    type: RESET_SECURITY_FLOW_TYPE
  ): Promise<{ [id: string]: string }> {
    const rpInsertResult: InsertResetSecurityFlowResult =
      await createQueryBuilder()
        .insert()
        .into(ResetSecurityFlow)
        .values(contactIds.map((id) => ({ contact: { id }, type })))
        .returning(["id", "contact"])
        .execute();

    const rpFlowIdsByContactId = Object.fromEntries(
      (rpInsertResult.raw || []).map((rpFlow) => [rpFlow.contactId, rpFlow.id])
    );

    return rpFlowIdsByContactId;
  }

  /**
   * Deletes all reset security flows for a contact.
   * @param contact The contact
   */
  async deleteAll(contact: Contact) {
    return await getRepository(ResetSecurityFlow).delete({
      contactId: contact.id
    });
  }

  /**
   * Gets a reset security flow, as long as it hasn't expired
   * @param id The reset security flow id
   * @returns The reset security flow
   */
  async get(id: string) {
    return await getRepository(ResetSecurityFlow).findOne({
      where: { id, date: MoreThan(subHours(new Date(), 24)) },
      relations: ["contact"]
    });
  }
}

export default new ResetSecurityFlowService();

import { getRepository } from "@core/database";
import { generateApiKey } from "@core/utils/auth";

import ApiKey from "@models/ApiKey";
import Contact from "@models/Contact";

class ApiKeyService {
  /**
   * Create a new API key
   * @param creator The contact that created the API key
   * @param description A description of the API key
   * @param expires When the API key expires, or null if it never expires
   * @returns the new API key token
   */
  async create(
    creator: Contact,
    description: string,
    expires: Date | null
  ): Promise<string> {
    const { id, secretHash, token } = generateApiKey();

    await getRepository(ApiKey).save({
      id,
      secretHash,
      creator,
      description,
      expires
    });

    return token;
  }

  /**
   * Delete an API key
   * @param id The API key ID
   * @returns Whether the API key was deleted
   */
  async delete(id: string): Promise<boolean> {
    const res = await getRepository(ApiKey).delete({ id });
    return !!res.affected;
  }

  /**
   * Permanently disassociate an API key from a contact
   * @param contact The contact
   */
  async permanentlyDeleteContact(contact: Contact) {
    await getRepository(ApiKey).update(
      { creatorId: contact.id },
      { creatorId: null }
    );
  }
}

export default new ApiKeyService();

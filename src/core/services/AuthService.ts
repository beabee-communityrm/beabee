import crypto from "crypto";
import { Request } from "express";
import { getRepository } from "typeorm";

import ContactsService from "./ContactsService";

import ApiKey from "@models/ApiKey";
import Contact from "@models/Contact";

class AuthService {
  /**
   * Check if the request is authenticated.
   */
  async check(request: Request): Promise<true | Contact | undefined> {
    const headers = request.headers;
    const authHeader = headers.authorization;

    // If there's a bearer key check API key
    if (authHeader?.startsWith("Bearer ")) {
      if (await this.isValidApiKey(authHeader.substring(7))) {
        // API key can act as a user
        const contactId = headers["x-contact-id"]?.toString();
        return contactId ? await ContactsService.findOne(contactId) : true;
      }
      return undefined; // Invalid key, not authenticated
    }

    // Otherwise use logged in user
    return request.user;
  }
  private async isValidApiKey(key: string): Promise<boolean> {
    const [_, secret] = key.split("_");
    const secretHash = crypto.createHash("sha256").update(secret).digest("hex");
    const apiKey = await getRepository(ApiKey).findOne({ secretHash });
    return !!apiKey && (!apiKey.expires || apiKey.expires > new Date());
  }
}

export default new AuthService();

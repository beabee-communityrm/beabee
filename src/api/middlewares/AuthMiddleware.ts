import crypto from "node:crypto";

import { Request, Response } from "express";
import { Middleware, ExpressMiddlewareInterface } from "routing-controllers";

import ContactsService from "@core/services/ContactsService";

import { AuthInfo } from "@type/auth-info";
import Contact from "@models/Contact";
import ApiKey from "@models/ApiKey";
import { getRepository } from "@core/database";

@Middleware({ type: "before" })
export class AuthMiddleware implements ExpressMiddlewareInterface {
  async use(
    req: Request,
    res: Response,
    next: (err?: any) => any
  ): Promise<void> {
    const entity = await getAuthEntity(req);
    if (entity) {
      req.auth = {
        entity,
        roles:
          entity instanceof Contact
            ? entity.activeRoles
            : // API is superadmin
              ["admin", "superadmin"]
      };
    }
    next();
  }
}

async function getAuthEntity(
  request: Request
): Promise<ApiKey | Contact | undefined> {
  const headers = request.headers;
  const authHeader = headers.authorization;

  // If there's a bearer key check API key
  if (authHeader?.startsWith("Bearer ")) {
    const apiKey = await getValidApiKey(authHeader.substring(7));
    if (apiKey) {
      // API key can act as a user
      const contactId = headers["x-contact-id"]?.toString();
      console.log("contact", contactId);
      return contactId
        ? await ContactsService.findOneBy({ id: contactId })
        : apiKey;
    }
    return undefined; // Invalid key, not authenticated
  }

  // Otherwise use logged in user
  return request.user as Contact | undefined;
}

async function getValidApiKey(key: string): Promise<ApiKey | undefined> {
  const [_, secret] = key.split("_");
  const secretHash = crypto.createHash("sha256").update(secret).digest("hex");
  const apiKey = await getRepository(ApiKey).findOneBy({ secretHash });
  return !!apiKey && (!apiKey.expires || apiKey.expires > new Date())
    ? apiKey
    : undefined;
}

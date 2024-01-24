import crypto from "node:crypto";

import { Request, Response } from "express";
import { Middleware, ExpressMiddlewareInterface } from "routing-controllers";

import { getRepository } from "@core/database";

import ContactsService from "@core/services/ContactsService";

import ApiKey from "@models/ApiKey";

import { AuthInfo } from "@type/auth-info";

@Middleware({ type: "before" })
export class AuthMiddleware implements ExpressMiddlewareInterface {
  async use(
    req: Request,
    res: Response,
    next: (err?: any) => any
  ): Promise<void> {
    req.auth = await getAuth(req);
    next();
  }
}

async function getAuth(request: Request): Promise<AuthInfo | undefined> {
  const headers = request.headers;
  const authHeader = headers.authorization;

  // If there's a bearer key check API key
  if (authHeader?.startsWith("Bearer ")) {
    const apiKey = await getValidApiKey(authHeader.substring(7));
    if (apiKey) {
      // API key can act as a user
      const contactId = headers["x-contact-id"]?.toString();
      if (contactId) {
        const contact = await ContactsService.findOneBy({ id: contactId });
        if (contact) {
          return {
            method: "api-key",
            entity: contact,
            // API can never acquire superadmin role
            roles: contact.activeRoles.filter((r) => r !== "superadmin")
          };
        }
      } else {
        return {
          method: "api-key",
          entity: apiKey,
          roles: apiKey.activeRoles
        };
      }
    }
  } else if (request.user) {
    return {
      method: "user",
      entity: request.user,
      roles: request.user.activeRoles
    };
  }
}

async function getValidApiKey(key: string): Promise<ApiKey | undefined> {
  const [_, secret] = key.split("_");
  const secretHash = crypto.createHash("sha256").update(secret).digest("hex");
  const apiKey = await getRepository(ApiKey).findOneBy({ secretHash });
  return !!apiKey && (!apiKey.expires || apiKey.expires > new Date())
    ? apiKey
    : undefined;
}

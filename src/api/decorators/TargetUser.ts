import { validateOrReject } from "class-validator";
import { Request } from "express";
import {
  NotFoundError,
  UnauthorizedError,
  createParamDecorator
} from "routing-controllers";

import ContactsService from "@core/services/ContactsService";

import { UUIDParams } from "@api/params/UUIDParams";

import Contact from "@models/Contact";

/**
 * The target user can either be the current user or for admins
 * it can be any user, this decorator injects the correct target
 * and also ensures the user has the correct roles
 * @returns The target user
 */
export function TargetUser() {
  return createParamDecorator({
    required: true,
    value: async (action): Promise<Contact> => {
      const request: Request = action.request;

      const auth = request.auth;
      if (!auth) {
        throw new UnauthorizedError();
      }

      const id = request.params.id;
      if (id !== "me" && auth.roles.includes("admin")) {
        const uuid = new UUIDParams();
        uuid.id = id;
        await validateOrReject(uuid);

        const target = await ContactsService.findOneBy({ id });
        if (target) {
          return target;
        } else {
          throw new NotFoundError();
        }
      } else if (
        auth.entity instanceof Contact &&
        (id === "me" || id === auth.entity.id)
      ) {
        return auth.entity;
      } else {
        throw new UnauthorizedError();
      }
    }
  });
}

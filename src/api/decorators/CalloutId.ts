import { isUUID } from "class-validator";
import { NotFoundError, createParamDecorator } from "routing-controllers";

import { getRepository } from "@core/database";

import Callout from "@models/Callout";

/**
 * Allows the use of either a callout ID or slug in the route
 * @returns A callout ID or undefined
 */
export function CalloutId() {
  return createParamDecorator({
    required: true,
    value: async (action): Promise<string | undefined> => {
      const id = action.request.params.id;
      if (isUUID(id)) {
        return id;
      } else {
        const callout = await getRepository(Callout).findOne({
          select: { id: true },
          where: { slug: id }
        });
        if (!callout) {
          throw new NotFoundError();
        }

        return callout.id;
      }
    }
  });
}

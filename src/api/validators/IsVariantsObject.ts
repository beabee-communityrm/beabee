import { ValidateBy, ValidationOptions, buildMessage } from "class-validator";

import { validateOrReject } from "#api/utils";

async function isVariantsObject(value: unknown): Promise<boolean> {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const variants = value as Record<string, unknown>;

  for (const key in variants) {
    const variant = variants[key];
    if (typeof variant !== "object" || variant === null) {
      return false;
    }
    await validateOrReject(variant);
  }

  return true;
}

export default function IsVariantsObject(
  validationOptions?: ValidationOptions
): PropertyDecorator {
  return ValidateBy(
    {
      name: "isVariantsObject",
      validator: {
        validate: isVariantsObject,
        defaultMessage: buildMessage(
          (eachPrefix) => eachPrefix + "$property must be an object",
          validationOptions
        )
      }
    },
    validationOptions
  );
}

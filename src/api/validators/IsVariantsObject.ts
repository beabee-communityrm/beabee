import {
  ValidateBy,
  ValidationOptions,
  buildMessage,
  validateOrReject
} from "class-validator";

async function isVariantsObject(value: unknown): Promise<boolean> {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const variants = value as Record<string, unknown>;

  if (!variants.default) {
    return false;
  }

  for (const key in variants) {
    const variant = variants[key];
    if (typeof variant !== "object" || variant === null) {
      return false;
    }
    await validateOrReject(variant, { skipMissingProperties: true });
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

import {
  ValidateBy,
  ValidationOptions,
  buildMessage,
  validate
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
    if (
      typeof variant !== "object" ||
      variant === null ||
      (await validate(variant)).length > 0
    ) {
      return false;
    }
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
          (eachPrefix) =>
            eachPrefix + "$property must be a record CalloutVariantDto",
          validationOptions
        )
      }
    },
    validationOptions
  );
}

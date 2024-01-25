import { buildMessage, ValidateBy, ValidationOptions } from "class-validator";
import slugify from "slugify";

export function isSlug(slug: unknown): boolean {
  return typeof slug === "string" && slug === slugify(slug);
}

export default function IsSlug(
  validationOptions?: ValidationOptions
): PropertyDecorator {
  return ValidateBy(
    {
      name: "isSlug",
      validator: {
        validate: isSlug,
        defaultMessage: buildMessage(
          (eachPrefix) => eachPrefix + "$property must be a slug",
          validationOptions
        )
      }
    },
    validationOptions
  );
}

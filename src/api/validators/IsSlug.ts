import { isSlug } from "@beabee/beabee-common";
import { buildMessage, ValidateBy, ValidationOptions } from "class-validator";

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

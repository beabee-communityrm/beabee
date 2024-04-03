import { isLngLat } from "@beabee/beabee-common";
import { buildMessage, ValidateBy, ValidationOptions } from "class-validator";

export default function IsLngLat(
  validationOptions?: ValidationOptions
): PropertyDecorator {
  return ValidateBy(
    {
      name: "isLngLat",
      validator: {
        validate: isLngLat,
        defaultMessage: buildMessage(
          (eachPrefix) => eachPrefix + "$property must be a [lng, lat]",
          validationOptions
        )
      }
    },
    validationOptions
  );
}

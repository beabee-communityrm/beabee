import { isMapBounds } from "@beabee/beabee-common";
import { ValidateBy, ValidationOptions, buildMessage } from "class-validator";

export default function IsMapBounds(
  validationOptions?: ValidationOptions
): PropertyDecorator {
  return ValidateBy(
    {
      name: "isMapBounds",
      validator: {
        validate: isMapBounds,
        defaultMessage: buildMessage(
          (eachPrefix) =>
            eachPrefix + "$property must be a [[lng, lat], [lng, lat]]",
          validationOptions
        )
      }
    },
    validationOptions
  );
}

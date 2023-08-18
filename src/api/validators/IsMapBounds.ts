import { ValidateBy, ValidationOptions, buildMessage } from "class-validator";
import { isLngLat } from "./IsLngLat";

export default function IsMapBounds(
  validationOptions?: ValidationOptions
): PropertyDecorator {
  return ValidateBy(
    {
      name: "isMapBounds",
      validator: {
        validate(value) {
          return (
            Array.isArray(value) && value.length === 2 && value.every(isLngLat)
          );
        },
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

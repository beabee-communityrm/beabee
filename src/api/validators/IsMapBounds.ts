import { ValidateBy, ValidationOptions, buildMessage } from "class-validator";
import { isLngLat } from "./IsLngLat";

export function isMapBounds(
  value: unknown
): value is [[number, number], [number, number]] {
  return Array.isArray(value) && value.length === 2 && value.every(isLngLat);
}

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

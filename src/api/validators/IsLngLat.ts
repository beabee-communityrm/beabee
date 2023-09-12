import { buildMessage, ValidateBy, ValidationOptions } from "class-validator";

function isAngle(value: unknown): value is number {
  return typeof value === "number" && value >= -180 && value <= 180;
}

export function isLngLat(value: unknown): value is [number, number] {
  return Array.isArray(value) && value.length === 2 && value.every(isAngle);
}

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

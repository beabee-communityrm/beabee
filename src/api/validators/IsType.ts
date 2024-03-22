import { isType } from "@beabee/beabee-common";
import { ValidateBy, ValidationOptions } from "class-validator";
import { ValidationArguments } from "class-validator/types/validation/ValidationArguments";

export function IsType(
  types: Array<
    | "string"
    | "number"
    | "bigint"
    | "boolean"
    | "symbol"
    | "undefined"
    | "object"
    | "function"
  >,
  validationOptions?: ValidationOptions
): PropertyDecorator {
  return ValidateBy(
    {
      name: "isType",
      validator: {
        validate: (value: unknown) => isType(types, value),
        defaultMessage: ({ value }: ValidationArguments) =>
          `Current type ${typeof value} is not in [${types.join(", ")}]`
      }
    },
    validationOptions
  );
}

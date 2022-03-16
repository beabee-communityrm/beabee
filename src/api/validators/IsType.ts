import { ValidateBy, ValidationOptions } from "class-validator";
import { ValidationArguments } from "class-validator/types/validation/ValidationArguments";

const IS_TYPE = "isType";

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
      name: IS_TYPE,
      validator: {
        validate: (value: unknown) => types.includes(typeof value),
        defaultMessage: ({ value }: ValidationArguments) =>
          `Current type ${typeof value} is not in [${types.join(", ")}]`
      }
    },
    validationOptions
  );
}

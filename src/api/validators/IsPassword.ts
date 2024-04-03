import { isPassword } from "@beabee/beabee-common";
import { ValidateBy, ValidationOptions, buildMessage } from "class-validator";

export default function IsPassword(
  validationOptions?: ValidationOptions
): PropertyDecorator {
  return ValidateBy(
    {
      name: "isPassword",
      validator: {
        validate: isPassword,
        defaultMessage: buildMessage(
          (eachPrefix) => eachPrefix + "$property must be a valid password",
          validationOptions
        )
      }
    },
    validationOptions
  );
}

import { ValidateBy, ValidationOptions, buildMessage } from "class-validator";

export function isPassword(password: unknown): boolean {
  return (
    typeof password === "string" &&
    password.length >= 8 &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /[0-9]/.test(password)
  );
}

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

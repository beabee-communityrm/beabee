import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface
} from "class-validator";

@ValidatorConstraint({ name: "isPassword" })
export default class IsPassword implements ValidatorConstraintInterface {
  validate(password: unknown): boolean | Promise<boolean> {
    return (
      typeof password === "string" &&
      password.length >= 8 &&
      /[a-z]/.test(password) &&
      /[A-Z]/.test(password) &&
      /[0-9]/.test(password)
    );
  }

  defaultMessage(args: ValidationArguments) {
    return `${args.property} does not meet password requirements`;
  }
}

import { ValidatorOptions, validate } from "class-validator";
import { BadRequestError } from "routing-controllers";

/**
 * Validate an object using the same base options as the main API validator
 * @param object The object
 * @param validationOptions Other validation options
 */
export async function validateOrReject(
  object: object,
  validationOptions?: ValidatorOptions
): Promise<void> {
  const errors = await validate(object, {
    whitelist: true,
    forbidNonWhitelisted: true,
    forbidUnknownValues: true,
    validationError: {
      target: false,
      value: false
    },
    ...validationOptions
  });

  if (errors.length > 0) {
    const error: any = new BadRequestError(
      `Invalid data, check 'errors' property for more info`
    );
    error.errors = errors;
    throw error;
  }
}

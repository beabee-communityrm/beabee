import { ValidatorOptions, validate } from "class-validator";
import { Request } from "express";

import Contact from "#models/Contact";
import { BadRequestError } from "routing-controllers";

export function login(req: Request, contact: Contact): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    req.login(contact, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

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

export function groupBy<T>(
  items: T[],
  keyFn: (item: T) => string
): { [key: string]: T[] | undefined } {
  const result: { [key: string]: T[] } = {};
  for (const item of items) {
    const value = keyFn(item);
    if (!result[value]) result[value] = [];
    result[value].push(item);
  }
  return result;
}

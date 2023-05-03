import { Request } from "express";
import { BadRequestError } from "routing-controllers";

import Contact from "@models/Contact";
import { validate } from "class-validator";

export function login(req: Request, contact: Contact): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    req.login(contact, (error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

export async function validateOrReject(data: object) {
  const errors = await validate(data, {
    validationError: { target: false, value: false }
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

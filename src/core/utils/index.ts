import { ContributionPeriod, PaymentMethod } from "@beabee/beabee-common";
import { NextFunction, Request, RequestHandler, Response } from "express";
import { QueryFailedError } from "typeorm";

export interface PaymentForm {
  monthlyAmount: number;
  period: ContributionPeriod;
  payFee: boolean;
  prorate: boolean;
}

export interface GoCardlessDirectDebitPaymentSource {
  method: PaymentMethod.GoCardlessDirectDebit;
  bankName: string;
  accountHolderName: string;
  accountNumberEnding: string;
}

export interface StripeCardPaymentSource {
  method: PaymentMethod.StripeCard;
  last4: string;
  expiryMonth: number;
  expiryYear: number;
}

export interface StripeBACSPaymentSource {
  method: PaymentMethod.StripeBACS;
  sortCode: string;
  last4: string;
}

export interface StripeSEPAPaymentSource {
  method: PaymentMethod.StripeSEPA;
  country: string;
  bankCode: string;
  branchCode: string;
  last4: string;
}

export interface ManualPaymentSource {
  method: null;
  source?: string;
  reference?: string;
}

export type PaymentSource =
  | GoCardlessDirectDebitPaymentSource
  | StripeCardPaymentSource
  | StripeBACSPaymentSource
  | StripeSEPAPaymentSource
  | ManualPaymentSource;

export function getActualAmount(
  amount: number,
  period: ContributionPeriod
): number {
  // TODO: fix this properly
  return Math.round(amount * (period === ContributionPeriod.Annually ? 12 : 1));
}

export function isValidNextUrl(url: string): boolean {
  return /^\/([^/]|$)/.test(url);
}

export function wrapAsync(fn: RequestHandler): RequestHandler {
  return async (req, res, next) => {
    try {
      await fn(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

export interface RequestWithUser extends Request {
  user: Express.User;
}

export function hasUser(
  fn: (
    req: RequestWithUser,
    res: Response,
    next: NextFunction
  ) => void | Promise<void>
): RequestHandler {
  return (req, res, next) => {
    if (req.user) {
      return fn(req as RequestWithUser, res, next);
    } else {
      next();
    }
  };
}

export function isSocialScraper(req: Request): boolean {
  return /^(Twitterbot|facebookexternalhit)/.test(
    req.headers["user-agent"] || ""
  );
}

export function getNextParam(url: string): string {
  return isValidNextUrl(url) ? "?next=" + encodeURIComponent(url) : "";
}

export function cleanEmailAddress(email: string): string {
  return email.trim().toLowerCase();
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createDateTime(date: string, time: string): Date;
export function createDateTime(
  date: string | undefined,
  time: string | undefined
): Date | null;
export function createDateTime(
  date: string | undefined,
  time: string | undefined
): Date | null {
  return date && time ? new Date(date + "T" + time) : null;
}

interface PgError {
  code: string;
  detail: string;
}

export function isDuplicateIndex(error: unknown, key?: string): boolean {
  if (error instanceof QueryFailedError) {
    const pgError = error as unknown as PgError;
    const keyTest = key && new RegExp(`^Key \\("?${key}"?\\).* already exists`);
    if (
      pgError.code === "23505" &&
      (!keyTest || keyTest.test(pgError.detail))
    ) {
      return true;
    }
  }
  return false;
}

export function isInvalidType(error: unknown): boolean {
  if (error instanceof QueryFailedError) {
    const pgError = error as unknown as PgError;
    return pgError.code === "22P02";
  }
  return false;
}

// From https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions#escaping
export function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); // $& means the whole matched string
}

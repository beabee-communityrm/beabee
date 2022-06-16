import { NextFunction, Request, RequestHandler, Response } from "express";
import moment from "moment";
import { QueryFailedError } from "typeorm";

export interface ContributionInfo {
  type: ContributionType;
  amount?: number;
  nextAmount?: number;
  period?: ContributionPeriod;
  cancellationDate?: Date;
  renewalDate?: Date;
  paymentSource?: PaymentSource;
  payFee?: boolean;
  hasPendingPayment?: boolean;
  membershipStatus: "active" | "expiring" | "expired" | "none";
  membershipExpiryDate?: Date;
}

export enum ContributionPeriod {
  Monthly = "monthly",
  Annually = "annually"
}

export enum ContributionType {
  Automatic = "Automatic",
  Manual = "Manual",
  Gift = "Gift",
  None = "None"
}

export interface PaymentForm {
  monthlyAmount: number;
  period: ContributionPeriod;
  payFee: boolean;
  prorate: boolean;
}

export enum PaymentMethod {
  StripeCard = "s_card",
  StripeSEPA = "s_sepa",
  StripeBACS = "s_bacs",
  GoCardlessDirectDebit = "gc_direct-debit"
}

export interface CardPaymentSource {
  method: PaymentMethod.StripeCard;
  last4: string;
  expiryMonth: number;
  expiryYear: number;
}

export interface GoCardlessDirectDebitPaymentSource {
  method: PaymentMethod.GoCardlessDirectDebit;
  bankName: string;
  accountHolderName: string;
  accountNumberEnding: string;
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

export type PaymentSource =
  | CardPaymentSource
  | GoCardlessDirectDebitPaymentSource
  | StripeBACSPaymentSource
  | StripeSEPAPaymentSource;

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
  return date && time ? moment.utc(date + "T" + time).toDate() : null;
}

interface PgError {
  code: string;
  detail: string;
}

export function isDuplicateIndex(error: unknown, key: string): boolean {
  if (error instanceof QueryFailedError) {
    const pgError = error as unknown as PgError;
    const keyTest = new RegExp(`^Key \\("?${key}"?\\).* already exists`);
    if (pgError.code === "23505" && keyTest.test(pgError.detail)) {
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

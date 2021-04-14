import { NextFunction, Request, RequestHandler, Response } from 'express';
import moment from 'moment';
import { QueryFailedError } from 'typeorm';

export enum ContributionPeriod {
	Monthly = 'monthly',
	Annually = 'annually'
}

export enum ContributionType {
	GoCardless = 'GoCardless',
	Manual = 'Manual',
	Gift = 'Gift',
	None = 'None'
}

export interface PaymentForm {
	amount: number;
	period: ContributionPeriod;
	payFee: boolean;
	prorate: boolean;
}

export interface ReferralGiftForm {
	referralGift?: string
	referralGiftOptions?: Record<string, string>
}

export function getActualAmount(amount: number, period: ContributionPeriod): number {
	return amount * ( period === ContributionPeriod.Annually ? 12 : 1 );
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
	user: Express.User
}

export function hasUser(fn: (req: RequestWithUser, res: Response, next: NextFunction) => void|Promise<void>): RequestHandler {
	return (req, res, next) => {
		if (req.user) {
			return fn(req as RequestWithUser, res, next);
		} else {
			next();
		}
	};
}

export function isSocialScraper(req: Request): boolean {
	return /^(Twitterbot|facebookexternalhit)/.test(req.headers['user-agent'] || '');
}

export function getNextParam(url: string): string {
	return isValidNextUrl( url ) ? '?next=' + encodeURIComponent( url ) : '';
}

export function cleanEmailAddress(email: string): string {
	return email.trim().toLowerCase();
}

export function sleep(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

export function createDateTime(date: string, time: string): Date;
export function createDateTime(date: string|undefined, time: string|undefined): Date|undefined;
export function createDateTime(date: string|undefined, time: string|undefined): Date|undefined {
	return date && time ? moment.utc(date + 'T' + time).toDate() : undefined;
}

interface PgError {
	code: string
	detail: string
}

// TODO: this method binds us to Postgres
export function isDuplicateIndex(error: Error, key: string): boolean {
	if (error instanceof QueryFailedError) {
		const pgError = error as unknown as PgError;
		const keyTest = new RegExp(`^Key \\("?${key}"?\\).* already exists`);
		if (pgError.code === '23505' && keyTest.test(pgError.detail)) {
			return true;
		}
	}
	return false;
}

export function isInvalidType(error: Error): boolean {
	if (error instanceof QueryFailedError) {
		const pgError = error as unknown as PgError;
		return pgError.code === '22P02';
	}
	return false;
}

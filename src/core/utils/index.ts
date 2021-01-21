import { NextFunction, Request, RequestHandler, Response } from 'express';

import { Member } from '@models/members';
import { QueryFailedError } from 'typeorm';

export enum ContributionPeriod {
	Monthly = 'monthly',
	Annually = 'annually',
	Gift = 'gift'
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

export interface AppConfig {
	title: string
	path: string
	permissions?: string[]
	menu?: 'none'|'main'
	priority?: number
}

export interface FullAppConfig extends AppConfig {
	uid: string
	disabled: boolean
	priority: number
	appPath: string
	hidden?: boolean
	subApps: FullAppConfig[]
	menu: 'none'|'main'
	permissions: string[]
}

export type AppConfigOverrides = Record<string, AppConfigOverride>;

export interface AppConfigOverride {
	config?: Partial<AppConfig>
	subApps?: AppConfigOverrides
}


export function isValidNextUrl(url: string): boolean {
	return /^\/([^/]|$)/.test(url);
}

export function getActualAmount(amount: number, period: ContributionPeriod): number {
	return amount * ( period === ContributionPeriod.Annually ? 12 : 1 );
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
	user: Member
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

export function loginAndRedirect(req: Request, res: Response, member: Member, url = '/'): void {
	req.login(member, function (loginError) {
		if (loginError) {
			throw loginError;
		} else {
			res.redirect(url);
		}
	});
}

export function sleep(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

interface PgError {
	code: string
	detail: string
}

// TODO: this method binds us to Postgres
export function isDuplicateIndex(error: Error, key: string): boolean {
	if (error instanceof QueryFailedError) {
		const pgError = error as unknown as PgError;
		if (pgError.code === '23505' && pgError.detail.indexOf(`^Key (${key}).* already exists`)) {
			return true;
		}
	}
	return false;
}

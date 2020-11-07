import _ from 'lodash';

import { ContributionPeriod, Member } from '@core/services/MembersService';
import { Request, RequestHandler, Response } from 'express';

interface Param {
	name: string,
	label: string,
	type: string,
	values?: [string, string][],
}

interface Item {
	getParams?: () => Promise<Param[]>
}

type ParamValue = number|boolean|string;

export function isValidNextUrl(url: string): boolean {
	return /^\/([^/]|$)/.test(url);
}

export function getActualAmount(amount: number, period: ContributionPeriod): number {
	return amount * ( period === ContributionPeriod.Annually ? 12 : 1 );
}

export function getParamValue(s: string, param: Param): ParamValue {
	switch (param.type) {
	case 'number': return Number(s);
	case 'boolean': return s === 'true';
	case 'select': return param.values.map(([k]) => k).find(k => s === k);
	default: return s;
	}
}

export function getChargeableAmount(amount: number, period: ContributionPeriod, payFee: boolean): number {
	const actualAmount = getActualAmount(amount, period);
	return payFee ? Math.floor(actualAmount / 0.99 * 100) + 20 : actualAmount * 100;
}

export function wrapAsync(fn: RequestHandler): RequestHandler {
	return async (req, res, next) => {
		try {
			await fn(req, res, next);
		} catch (error) {
			req.log.error(error);
			next(error);
		}
	};
}

export function isSocialScraper(req: Request): boolean {
	return /^(Twitterbot|facebookexternalhit)/.test(req.headers['user-agent']);
}

export function getNextParam(url: string): string {
	return isValidNextUrl( url ) ? '?next=' + encodeURIComponent( url ) : '';
}

export function cleanEmailAddress(email: string): string {
	return email.trim().toLowerCase();
}
export function loginAndRedirect(req: Request, res: Response, member: Member): void {
	req.login(member, function (loginError) {
		if (loginError) {
			throw loginError;
		} else {
			res.redirect('/');
		}
	});
}
export function sleep(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}

export async function loadParams(items: Item[]): Promise<{params: Param[]}[]> {
	const itemsWithParams = [];
	for (const item of items) {
		itemsWithParams.push({
			...item,
			params: item.getParams ? await item.getParams() : []
		});
	}
	return itemsWithParams;
}

export async function parseParams(item: Item, data: Record<string, string>): Promise<Record<string, ParamValue>> {
	const params = item.getParams ? await item.getParams() : [];
	return _.mapValues(data, (value, paramName) => {
		const param = params.find(p => p.name === paramName);
		if (param) {
			return getParamValue(value, param);
		}
	});
}
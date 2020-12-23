import defaultOptions from '@core/defaults.json';
import Option from '@models/Option';
import { NextFunction, Request, Response } from 'express';
import { getRepository } from 'typeorm';

interface OptionWithDefault extends Option {
	default: boolean;
}

export default class OptionsService {
	private static optionCache: Record<string, OptionWithDefault>;

	static async reload(): Promise<void> {
		OptionsService.optionCache = {};
		for (const key in defaultOptions) {
			OptionsService.optionCache[key] = {
				key,
				value: defaultOptions[key],
				default: true
			};
		}
		(await getRepository(Option).find()).map(option => {
			OptionsService.optionCache[option.key] = {...option, default: false};
		});
	}

	static get(key: string): OptionWithDefault {
		return OptionsService.optionCache[key];
	}

	static getText(key: string): string {
		return OptionsService.get(key)?.value;
	}

	static getInt(key: string): number {
		const option = OptionsService.get(key);
		return option && parseInt(option.value);
	}

	static getBool(key: string): boolean {
		switch (OptionsService.get(key)?.value) {
		case 'true': return true;
		case 'false': return false;
		default: return;
		}
	}

	static async set(key: string, value: string|number|boolean): Promise<void> {
		const option = OptionsService.get(key);
		if (option) {
			option.value = value.toString();
			await getRepository(Option).save(option);
		}
	}

	static async reset(key: string): Promise<void> {
		const option = OptionsService.get(key);
		if (option) {
			option.value = defaultOptions[key];
			option.default = true;
			await getRepository(Option).delete(key);
		}
	}

	static middleware(req: Request, res: Response, next: NextFunction): void {
		res.locals.Options = OptionsService.getText.bind(OptionsService);
		next();
	}

}

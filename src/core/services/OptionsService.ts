import axios from 'axios';
import { getRepository } from 'typeorm';

import _defaultOptions from '@core/defaults.json';
import { log as mainLogger } from '@core/logging';

import config from '@config';

import Option from '@models/Option';

export type OptionKey = keyof typeof _defaultOptions;
const defaultOptions: {[key in OptionKey]: string} = _defaultOptions;

const log = mainLogger.child({app: 'options-service'});

interface OptionWithDefault extends Option {
	default: boolean;
}

export default class OptionsService {
	private static optionCache: Record<OptionKey, OptionWithDefault>;

	static isKey(s: string): s is OptionKey {
		return s in defaultOptions;
	}

	static async reload(): Promise<void> {
		log.debug({action: 'reload'});
		const newCache: Partial<Record<OptionKey, OptionWithDefault>> = {};
		for (const key of Object.keys(defaultOptions)) {
			newCache[key as OptionKey] = {
				key,
				value: defaultOptions[key as OptionKey],
				default: true
			};
		}
		(await getRepository(Option).find()).map(option => {
			if (OptionsService.isKey(option.key)) {
				newCache[option.key] = {...option, default: false};
			}
		});

		OptionsService.optionCache = newCache as Record<OptionKey, OptionWithDefault>;
	}

	static get(key: OptionKey): OptionWithDefault {
		return OptionsService.optionCache[key];
	}

	static getText(key: OptionKey): string {
		return OptionsService.get(key).value;
	}

	static getInt(key: OptionKey): number {
		return parseInt(OptionsService.getText(key));
	}

	static getBool(key: OptionKey): boolean {
		switch (OptionsService.getText(key)) {
		case 'true': return true;
		default: return false;
		}
	}

	static getAll(): Record<OptionKey, OptionWithDefault> {
		return OptionsService.optionCache;
	}

	static async set(key: OptionKey, value: string|number|boolean): Promise<void> {
		const option = OptionsService.get(key);
		if (option) {
			option.value = value.toString();
			option.default = false;
			await getRepository(Option).save(option);
			await OptionsService.notify();
		}
	}

	static async reset(key: OptionKey): Promise<void> {
		const option = OptionsService.get(key);
		if (option) {
			option.value = defaultOptions[key];
			option.default = true;
			await getRepository(Option).delete(key);
			await OptionsService.notify();
		}
	}

	// TODO: generalise this
	private static async notify() {
		try {
			await axios.post(`http://gc_webhook:${config.gocardless.internalPort}/reload`);
			await axios.post(`http://stripe_webhook:${config.stripe.internalPort}/reload`);
		} catch (error) {
			log.error({action: 'notify-failed', error}, 'Failed to notify apps of options change');
		}
	}
}

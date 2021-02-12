import axios from 'axios';
import { getRepository } from 'typeorm';

import _defaultOptions from '@core/defaults.json';
import { log as mainLogger } from '@core/logging';

import config from '@config';

import Option from '@models/Option';

const defaultOptions: {[key: string]: string} = _defaultOptions;
const log = mainLogger.child({app: 'options-service'});

interface OptionWithDefault extends Option {
	default: boolean;
}

export default class OptionsService {
	private static optionCache: Record<string, OptionWithDefault>;

	static async reload(): Promise<void> {
		log.debug({action: 'reload'});
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

	static get(key: string): OptionWithDefault|undefined {
		return OptionsService.optionCache[key];
	}

	static getText(key: string): string {
		return OptionsService.get(key)?.value || '';
	}

	static getInt(key: string): number|undefined {
		const option = OptionsService.get(key);
		return option && parseInt(option.value);
	}

	static getBool(key: string): boolean|undefined {
		switch (OptionsService.get(key)?.value) {
		case 'true': return true;
		case 'false': return false;
		default: return;
		}
	}

	static getAll(): Record<string, OptionWithDefault> {
		return OptionsService.optionCache;
	}

	static get currencySymbol(): string {
		switch (OptionsService.getText('currency_code').toLowerCase()) {
		case 'gbp': return '£';
		case 'eur': return '€';
		default: return '?';
		}
	}

	static async set(key: string, value: string|number|boolean): Promise<void> {
		const option = OptionsService.get(key);
		if (option) {
			option.value = value.toString();
			option.default = false;
			await getRepository(Option).save(option);
			await OptionsService.notify();
		}
	}

	static async reset(key: string): Promise<void> {
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

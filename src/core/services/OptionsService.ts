import axios from "axios";
import { getRepository } from "typeorm";

import _defaultOptions from "@core/defaults.json";
import { log as mainLogger } from "@core/logging";

import Option from "@models/Option";

export type OptionKey = keyof typeof _defaultOptions;
type OptionValue = string | boolean | number;
const defaultOptions: { [key in OptionKey]: string } = _defaultOptions;

const log = mainLogger.child({ app: "options-service" });

interface OptionWithDefault extends Option {
  default: boolean;
}

export default class OptionsService {
  private static optionCache: Record<OptionKey, OptionWithDefault>;

  static isKey(s: string): s is OptionKey {
    return s in defaultOptions;
  }

  static async reload(): Promise<void> {
    log.info("Reload cache");
    const newCache: Partial<Record<OptionKey, OptionWithDefault>> = {};
    for (const key of Object.keys(defaultOptions)) {
      newCache[key as OptionKey] = {
        key,
        value: defaultOptions[key as OptionKey],
        default: true
      };
    }
    (await getRepository(Option).find()).map((option) => {
      if (OptionsService.isKey(option.key)) {
        newCache[option.key] = { ...option, default: false };
      }
    });

    OptionsService.optionCache = newCache as Record<
      OptionKey,
      OptionWithDefault
    >;
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
      case "true":
        return true;
      default:
        return false;
    }
  }

  static getList(key: OptionKey): string[] {
    const text = OptionsService.getText(key);
    return text === "" ? [] : text.split(",").map((s) => s.trim());
  }

  static getJSON(key: OptionKey): any {
    return JSON.parse(OptionsService.getText(key));
  }

  static getAll(): Record<OptionKey, OptionWithDefault> {
    return OptionsService.optionCache;
  }

  static async set(opts: Record<OptionKey, OptionValue>): Promise<void>;
  static async set(key: OptionKey, value: OptionValue): Promise<void>;
  static async set(
    optsOrKey: Record<OptionKey, OptionValue> | OptionKey,
    value?: OptionValue
  ): Promise<void> {
    const opts = value
      ? { [optsOrKey as OptionKey]: value }
      : (optsOrKey as Record<OptionKey, OptionValue>);

    const options = Object.entries(opts).map(([key, value]) => {
      const option = OptionsService.get(key as OptionKey);
      option.value = value.toString();
      option.default = false;
      return option;
    });

    await getRepository(Option).save(options);
    await OptionsService.notify();
  }

  static async setJSON(key: OptionKey, value: any): Promise<void> {
    await OptionsService.set(key, JSON.stringify(value));
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

  private static async notify() {
    try {
      // TODO: remove hardcoded service references
      await axios.post("http://app:4000/reload");
      await axios.post("http://api_app:4000/reload");
      await axios.post("http://webhook_app:4000/reload");
    } catch (error) {
      log.error("Failed to notify webhook of options change", error);
    }
  }
}

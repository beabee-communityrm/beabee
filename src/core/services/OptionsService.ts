import { getRepository } from "@core/database";
import _defaultOptions from "@core/defaults.json";
import { log as mainLogger } from "@core/logging";
import NetworkCommunicatorService from "./NetworkCommunicatorService";

import Option from "@models/Option";

export type OptionKey = keyof typeof _defaultOptions;
type OptionValue = string | boolean | number;
const defaultOptions: { [key in OptionKey]: string } = _defaultOptions;

const log = mainLogger.child({ app: "options-service" });

interface OptionWithDefault extends Option {
  default: boolean;
}

class OptionsService {
  private optionCache: Record<OptionKey, OptionWithDefault> | undefined;

  constructor() {
    NetworkCommunicatorService.on("reload", this.reload.bind(this));
  }

  isKey(s: any): s is OptionKey {
    return s in defaultOptions;
  }

  async reload(): Promise<void> {
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
      if (this.isKey(option.key)) {
        newCache[option.key] = { ...option, default: false };
      }
    });

    this.optionCache = newCache as Record<OptionKey, OptionWithDefault>;
  }

  get(key: OptionKey): OptionWithDefault {
    if (!this.optionCache) {
      throw new Error("OptionsService not initialised");
    }
    return this.optionCache[key];
  }

  getText(key: OptionKey): string {
    return this.get(key).value;
  }

  getInt(key: OptionKey): number {
    return parseInt(this.getText(key));
  }

  getBool(key: OptionKey): boolean {
    switch (this.getText(key)) {
      case "true":
        return true;
      default:
        return false;
    }
  }

  getList(key: OptionKey): string[] {
    const text = this.getText(key);
    return text === "" ? [] : text.split(",").map((s) => s.trim());
  }

  getJSON(key: OptionKey): any {
    return JSON.parse(this.getText(key));
  }

  getAll(): Record<OptionKey, OptionWithDefault> {
    if (!this.optionCache) {
      throw new Error("OptionsService not initialised");
    }
    return this.optionCache;
  }

  async set(opts: Partial<Record<OptionKey, OptionValue>>): Promise<void>;
  async set(key: OptionKey, value: OptionValue): Promise<void>;
  async set(
    optsOrKey: Partial<Record<OptionKey, OptionValue>> | OptionKey,
    value?: OptionValue
  ): Promise<void> {
    const opts =
      this.isKey(optsOrKey) && value !== undefined
        ? { [optsOrKey]: value }
        : optsOrKey;

    const options = Object.entries(opts).map(([key, value]) => {
      const option = this.get(key as OptionKey);
      option.value = value.toString();
      option.default = false;
      return option;
    });

    if (options.length) {
      await getRepository(Option).save(options);
      await NetworkCommunicatorService.notifyAll("reload");
    }
  }

  async setJSON(key: OptionKey, value: any): Promise<void> {
    await this.set(key, JSON.stringify(value));
  }

  async reset(key: OptionKey): Promise<void> {
    const option = this.get(key);
    if (option) {
      option.value = defaultOptions[key];
      option.default = true;
      await getRepository(Option).delete(key);
      await NetworkCommunicatorService.notifyAll("reload");
    }
  }
}

export default new OptionsService();

import axios from "axios";

import { getRepository } from "@core/database";
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

class OptionsService {
  private optionCache: Record<OptionKey, OptionWithDefault> | undefined;

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
      await this.notify();
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
      await this.notify();
    }
  }

  /**
   * Send a post request to an internal service
   * @param serviceName The name of the service
   * @param actionPath The path of the action
   * @param data The data to send
   * @returns 
   */
  private async post(serviceName: string, actionPath: string, data?: any) {
    try {
      return await axios.post(`http://${serviceName}:4000/${actionPath}`, data);
    } catch (error: any) {
      if (error.response && error.response.status === 404) {
        log.error(`Internal service "${serviceName}" not found`, error);
      } else {
        throw error;
      }
    }
  }

  /**
   * Send a post request to multiple internal services
   * @param serviceNames The service names
   * @param actionPath The path of the action
   * @param data The data to send
   */
  private async posts(serviceNames: string[], actionPath: string, data?: any) {
    for (const serviceName of serviceNames) {
      await this.post(serviceName, actionPath, data);
    }
  }

  private async notify() {
    try {
      // TODO: remove hardcoded service references
      const actionPath = "reload";
      await this.posts(["app", "api_app", "webhook_app", "telegram_bot"], actionPath)
    } catch (error) {
      log.error("Failed to notify webhook of options change", error);
    }
  }
}

export default new OptionsService();

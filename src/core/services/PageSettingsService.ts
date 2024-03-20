import { getRepository } from "#core/database";

import OptionsService from "#core/services/OptionsService";

import PageSettings from "#models/PageSettings";

interface PageSettingsCache extends PageSettings {
  patternRegex: RegExp;
}

export type JustPageSettings = Omit<PageSettings, "id" | "pattern">;

export default class PageSettingsService {
  private static pathCache: Record<string, JustPageSettings | "default"> = {};
  private static psCache: PageSettingsCache[] = [];

  static getPath(path: string): JustPageSettings {
    let cache = this.pathCache[path];
    if (cache === undefined) {
      cache = this.pathCache[path] =
        this.psCache.find((ps) => ps.patternRegex.test(path)) || "default";
    }
    return cache === "default"
      ? {
        shareUrl: "/",
        shareTitle: OptionsService.getText("share-title"),
        shareDescription: OptionsService.getText("share-description"),
        shareImage: OptionsService.getText("share-image")
      }
      : cache;
  }

  static async reload(): Promise<void> {
    this.psCache = (await getRepository(PageSettings).find()).map((ps) => ({
      ...ps,
      patternRegex: new RegExp(ps.pattern)
    }));
    this.pathCache = {};
  }

  static async create(ps: PageSettings): Promise<PageSettings> {
    const savedPs = await getRepository(PageSettings).save(ps);
    await this.reload();
    return savedPs;
  }

  static async update(
    ps: PageSettings,
    fields: Partial<PageSettings>
  ): Promise<void> {
    await getRepository(PageSettings).update(ps.id, fields);
    await this.reload();
  }

  static async delete(ps: PageSettings): Promise<void> {
    await getRepository(PageSettings).delete(ps.id);
    await this.reload();
  }
}

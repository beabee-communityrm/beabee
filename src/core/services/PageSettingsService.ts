import { NextFunction, Request, Response } from 'express';
import { getRepository } from 'typeorm';

import PageSettings from '@models/PageSettings';

interface PageSettingsCache extends PageSettings {
	patternRegex: RegExp
}

type JustPageSettings = Omit<PageSettings, 'id'|'pattern'>;

export default class PageSettingsService {
	private static pathCache: Record<string, JustPageSettings> = {};
	private static psCache: PageSettingsCache[] = [];

	private static readonly defaultPageSettings = {
		shareUrl: '/',
		shareTitle: 'The Bristol Cable: News, Investigations & Events | The city\'s media co-operative.',
		shareDescription: 'Latest Bristol news, investigations &amp; events. The city\'s media co-operative – created and owned by local people. Sticking up for Bristol.',
		shareImage: 'https://membership.thebristolcable.org/static/imgs/share.jpg'
	};

	static getPath(path: string): JustPageSettings {
		if (this.pathCache[path] === undefined) {
			this.pathCache[path] = this.psCache.find(ps => ps.patternRegex.test(path)) || this.defaultPageSettings;
		}
		return this.pathCache[path];
	}

	static async reload(): Promise<void> {
		this.psCache = (await getRepository(PageSettings).find()).map(ps => ({
			...ps, patternRegex: new RegExp(ps.pattern)
		}));
		this.pathCache = {};
	}

	static async create(ps: PageSettings): Promise<PageSettings> {
		const savedPs = await getRepository(PageSettings).save(ps);
		await this.reload();
		return savedPs;
	}

	static async update(ps: PageSettings, fields: Partial<PageSettings>): Promise<void> {
		await getRepository(PageSettings).update(ps.id, fields);
		await this.reload();
	}

	static async delete(ps: PageSettings): Promise<void> {
		await getRepository(PageSettings).delete(ps.id);
		await this.reload();
	}
}

import PageSettings from '@models/PageSettings';
import { NextFunction, Request, Response } from 'express';
import { DeepPartial, getRepository } from 'typeorm';

interface PageSettingsCache extends PageSettings {
	patternRegex: RegExp
}

export default class PageSettingsService {
	private static pathsCache: Record<string, Pick<PageSettingsCache, 'shareUrl'|'shareTitle'|'shareDescription'|'shareImage'>> = {};
	private static pageSettingsCache: PageSettingsCache[] = [];

	private static readonly defaultPageSettings = {
		shareUrl: '/',
		shareTitle: 'The Bristol Cable: News, Investigations & Events | The city\'s media co-operative.',
		shareDescription: 'Latest Bristol news, investigations &amp; events. The city\'s media co-operative – created and owned by local people. Sticking up for Bristol.',
		shareImage: 'https://membership.thebristolcable.org/static/imgs/share.jpg'
	};

	private static get(path: string) {
		if (this.pathsCache[path] === undefined) {
			this.pathsCache[path] = this.pageSettingsCache.find(ps => ps.patternRegex.test(path)) || this.defaultPageSettings;
		}
		return this.pathsCache[path];
	}

	static async reload(): Promise<void> {
		this.pageSettingsCache = (await getRepository(PageSettings).find()).map(ps => ({
			...ps, patternRegex: new RegExp(ps.pattern)
		}));
		this.pathsCache = {};
	}

	static middleware(req: Request, res: Response, next: NextFunction): void {
		res.locals._page = this.get( req.path );
		next();
	}

	static async create(ps: PageSettings): Promise<PageSettings> {
		const savedPs = await getRepository(PageSettings).save(ps);
		await this.reload();
		return savedPs;
	}

	static async update(ps: PageSettings, fields: DeepPartial<PageSettings>): Promise<void> {
		await getRepository(PageSettings).update(ps.id, fields);
		await this.reload();
	}

	static async delete(ps: PageSettings): Promise<void> {
		await getRepository(PageSettings).delete(ps.id);
	}
}

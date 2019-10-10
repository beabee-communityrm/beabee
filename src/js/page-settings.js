const { PageSettings } = require( __js + '/database' );

let pathsCache = {};
let pageSettingsCache = [];

const defaultPageSettings = {
	shareUrl: '/',
	shareTitle: 'The Bristol Cable: News, Investigations & Events | The city\'s media co-operative.',
	shareDescription: 'Latest Bristol news, investigations &amp; events. The city\'s media co-operative – created and owned by local people. Sticking up for Bristol.',
	shareImage: 'https://membership.thebristolcable.org/static/imgs/share.jpg'
};

function getPageSettings( path ) {
	if (pathsCache[path] !== undefined) {
		return pathsCache[path];
	}
	return pathsCache[path] = pageSettingsCache.find(ps => ps.pattern.test(path));
}

module.exports = {
	async update() {
		pageSettingsCache = (await PageSettings.find()).map(ps => ({
			...ps.toObject(), pattern: new RegExp(ps.pattern)
		}));
		pathsCache = {};
	},
	middleware( req, res, next ) {
		res.locals._page = getPageSettings( req.path ) || defaultPageSettings;
		next();
	}
};

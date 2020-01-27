function isValidNextUrl(url) {
	return /^\/([^/]|$)/.test(url);
}

function getActualAmount(amount, period) {
	return amount * ( period === 'annually'  ? 12 : 1 );
}

function getParamValue(s, param) {
	switch (param.type) {
	case 'number': return Number(s);
	case 'boolean': return s === 'true';
	case 'select': return param.values.find(s2 => s === s2);
	default: return s;
	}
}

module.exports = {
	getActualAmount,
	getChargeableAmount(amount, period, payFee) {
		const actualAmount = getActualAmount(amount, period);
		return payFee ? Math.floor(actualAmount / 0.99 * 100) + 20 : actualAmount * 100;
	},
	wrapAsync(fn) {
		return async (req, res, next) => {
			try {
				await fn(req, res, next);
			} catch (error) {
				req.log.error(error);
				next(error);
			}
		};
	},
	isValidNextUrl,
	isSocialScraper(req) {
		return /^(Twitterbot|facebookexternalhit)/.test(req.headers['user-agent']);
	},
	getNextParam( url ) {
		return isValidNextUrl( url ) ? '?next=' + encodeURIComponent( url ) : '';
	},
	cleanEmailAddress(email) {
		return email.trim().toLowerCase();
	},
	loginAndRedirect(req, res, member) {
		req.login(member, function (loginError) {
			if (loginError) {
				throw loginError;
			} else {
				res.redirect('/');
			}
		});
	},
	sleep(ms) {
		return new Promise(resolve => setTimeout(resolve, ms));
	},
	loadParams: async (items) => {
		const itemsWithParams = [];
		for (const item of items) {
			itemsWithParams.push({
				...item,
				params: item.getParams ? await item.getParams() : []
			});
		}
		return itemsWithParams;
	},
	parseParams: async (item, data) => {
		const params = item.getParams ? await item.getParams() : [];
		let ret = {};
		for (let paramName in data) {
			const param = params.find(p => p.name === paramName);
			if (param) {
				ret[paramName] = getParamValue(data[paramName], param);
			}
		}
		return ret;
	}
};

function isValidNextUrl(url) {
	return /^\/([^/]|$)/.test(url);
}

module.exports = {
	getSubscriptionName(amount, period) {
		return `Membership: £${amount} ${period}`;
	},
	getActualAmount(amount, period) {
		return amount * ( period === 'annually'  ? 12 : 1 );
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
	}
};

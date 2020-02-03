const config = require( __config );

module.exports = {
	getSpecialUrlUrl(specialUrl) {
		return `${config.audience}/s/${specialUrl.uuid}`;
	}
};

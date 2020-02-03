const config = require( __config );

module.exports = {
	getSpecialUrlUrl(specialUrl) {
		const groupId = specialUrl.group._id || specialUrl.group; // Handle populated group
		return `${config.audience}/s/${groupId}/${specialUrl.uuid}`;
	}
};

const config = require("#config");

module.exports = {
  getSpecialUrlUrl(specialUrl) {
    return `${config.audience}/s/${specialUrl.uuid}`;
  }
};

const config = require('../../config/config.json');

const stripe = require('stripe')(config.stripe.secret_key);

module.exports = stripe;

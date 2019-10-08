const config = require( __config );

const stripe = require( 'stripe' )( config.stripe.secret_key );

module.exports = stripe;

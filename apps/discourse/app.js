const express = require( 'express' );
const DiscourseSSO = require( 'discourse-sso' );

const config = require( '@config' );

const auth = require( '@core/authentication' );

const app = express();

const sso = new DiscourseSSO( config.discourse.sso_secret );

app.get( '/sso', auth.isLoggedIn, async ( req, res ) => {
	const { sso: payload, sig } = req.query;

	if (payload && sig && sso.validate(payload, sig)) {
		const nonce = sso.getNonce(payload);
		const loginPayload = {
			nonce,
			email: req.user.email,
			external_id: req.user.uuid,
			name: req.user.fullname,
			username: req.user.email
		};
		const q = sso.buildLoginString(loginPayload);
		res.redirect(`${config.discourse.url}/session/sso_login?${q}`);
	} else {
		res.status(403).send({error: 'Invalid signature'});
	}
} );

module.exports = function () {
	return app;
};

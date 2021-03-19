import Stripe from 'stripe';
import config from '@config';

export default new Stripe(config.stripe.secret_key, {
	apiVersion: '2020-08-27',
	typescript: true
});

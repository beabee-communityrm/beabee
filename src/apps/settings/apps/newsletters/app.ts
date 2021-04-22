import express from 'express';

import { isSuperAdmin } from '@core/middleware';

import config from '@config';

const app = express();

app.set( 'views', __dirname + '/views' );

app.use(isSuperAdmin);

app.get('/', (req, res) => {
	res.render('index', {provider: config.newsletter.provider});
});

export default app;

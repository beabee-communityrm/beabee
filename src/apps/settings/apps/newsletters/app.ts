import express from 'express';

import { isSuperAdmin } from '@core/middleware';

const app = express();

app.set( 'views', __dirname + '/views' );

app.use(isSuperAdmin);

app.get('/', (req, res) => {
	res.render('index');
});

export default app;

import 'module-alias/register';

import { ConnectionOptions, getConnection } from 'typeorm';

import * as db from '@core/database';

import config from '@config';

db.connect(config.mongo, {...config.db, logging: true} as ConnectionOptions).then(async () => {
	await getConnection().synchronize();
	await db.close();
});

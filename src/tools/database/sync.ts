import 'module-alias/register';

import fs from 'fs';
import path from 'path';
import { ConnectionOptions, getConnection } from 'typeorm';

import * as db from '@core/database';

import config from '@config';

const sessionSqlPath = path.join(__dirname, 'session.sql');

db.connect(config.mongo, {...config.db, logging: true} as ConnectionOptions).then(async () => {
	const connection = getConnection();

	await connection.query('ALTER TABLE payment RENAME TO gc_payment');

	await connection.synchronize();

	const res = await connection.query(
		`SELECT EXISTS (
			SELECT 1
			FROM information_schema.tables
			WHERE table_name='session'
		)`
	);
	if (!res[0].exists) {
		await connection.query(fs.readFileSync(sessionSqlPath).toString());
	}

	await db.close();
});

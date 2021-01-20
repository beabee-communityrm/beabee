import 'module-alias/register';

import config from '@config';
import * as db from '@core/database';

async function main() {
	const member = await db.Permissions.create({
		name: 'Member',
		slug: config.permission.member
	});
	await db.Permissions.create({
		name: 'Admin',
		slug: config.permission.admin
	});
	await db.Permissions.create({
		name: 'Super Admin',
		slug: config.permission.superadmin
	});
	await db.Permissions.create({
		name: 'Access',
		slug: config.permission.access
	});

	console.log(`Set 'permission.memberId' to "${member._id}" in config/config.json`);
}

db.connect( config.mongo ).then(async () => {
	await main();
	await db.close();
});

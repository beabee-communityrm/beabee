global.__root = __dirname + '/..';
global.__apps = __root + '/apps';
global.__config = __root + '/config/config.json';
global.__js = __root + '/src/js';
global.__models = __root + '/src/models';

const config = require( __config );
const db = require( __js + '/database' ).connect( config.mongo );

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

main().then(() => db.mongoose.disconnect());

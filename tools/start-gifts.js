global.__root = __dirname + '/..';
global.__apps = __root + '/apps';
global.__config = __root + '/config/config.json';
global.__js = __root + '/src/js';
global.__models = __root + '/src/models';

const moment = require( 'moment' );

const config = require( __config );

const db = require( __js + '/database');
const log = require( __js + '/logging' ).log;
const { processGiftFlow } = require( __apps + '/gift/utils' );

async function main(date) {
	const fromDate = moment.utc(date).startOf('day');
	const toDate = moment.utc(date).endOf('day');

	log.info({
		app: 'start-gifts',
		action: 'begin',
		message: `Processing gifts between ${fromDate.format()} and ${toDate.format()}`
	});

	const giftFlows = await db.GiftFlows.find({
		'giftForm.startDate': {$gte: fromDate.toDate(), $lte: toDate.toDate()},
		completed: true,
		processed: {$ne: true}
	});

	log.info({
		app: 'start-gifts',
		action: 'got-gifts',
		message: `Got ${giftFlows.length} gifts`
	});

	for (const giftFlow of giftFlows) {
		log.info( {
			app: 'start-gifts',
			action: 'process-gift',
			giftFlowId: giftFlow._id
		} );

		await processGiftFlow(giftFlow);
	}
}

db.connect(config.mongo);

db.mongoose.connection.on('connected', () => {
	main(process.argv[2])
		.catch(err => log.error(err))
		.then(() => db.mongoose.disconnect());
});

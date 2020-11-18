require('module-alias/register');

const moment = require( 'moment' );

const config = require( '@config' );

const db = require( '@core/database');
const log = require( '@core/logging' ).log;
const { processGiftFlow } = require( '@apps/gift/utils' );

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

		try {
			await processGiftFlow(giftFlow);
		} catch (error) {
			log.error( {
				app: 'start-gifts',
				action: 'process-gift-error',
				error
			} );
		}
	}
}

db.connect(config.mongo);

db.mongoose.connection.on('connected', () => {
	main(process.argv[2])
		.catch(err => log.error(err))
		.then(() => db.mongoose.disconnect());
});

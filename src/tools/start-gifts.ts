import 'module-alias/register';

import moment from 'moment';
import { Between, ConnectionOptions, getRepository } from 'typeorm';

import * as db from '@core/database';
import { log } from '@core/logging';

import GiftService from '@core/services/GiftService';

import GiftFlow from '@models/GiftFlow';

import config from '@config';

async function main(date: string) {
	const fromDate = moment.utc(date).startOf('day');
	const toDate = moment.utc(date).endOf('day');

	log.info({
		app: 'start-gifts',
		action: 'begin',
		message: `Processing gifts between ${fromDate.format()} and ${toDate.format()}`
	});

	const giftFlows = await getRepository(GiftFlow).find({
		where: {
			giftForm: {startDate: Between(fromDate.toDate(), toDate.toDate())},
			completed: true,
			processed: false
		}
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
			giftFlowId: giftFlow.id
		} );

		try {
			await GiftService.processGiftFlow(giftFlow);
		} catch (error) {
			log.error( {
				app: 'start-gifts',
				action: 'process-gift-error',
				error
			} );
		}
	}
}

db.connect(config.mongo, config.db as ConnectionOptions).then(async () => {
	try {
		await main(process.argv[2]);
	} catch (err) {
		console.error(err);
	}
	await db.close();
});

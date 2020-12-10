import mongoose from 'mongoose';
import { createConnection, getConnection, ConnectionOptions } from 'typeorm';

import { log } from '@core/logging';

import Notice from '@models/Notice';
import JoinFlow from '@models/JoinFlow';

export async function connect( mongoUrl: string, dbConfig?: ConnectionOptions ): Promise<void> {
	mongoose.Promise = global.Promise;

	await new Promise(resolve => {
		mongoose.connect( mongoUrl, {
			useNewUrlParser: true,
			useCreateIndex: true,
			useUnifiedTopology: true
		} );

		mongoose.connection.on('connected', () => {
			log.debug( {
				app: 'database',
				action: 'connect',
				message: 'Connected to Mongo database'
			} );
			resolve();
		});
		mongoose.connection.on( 'error', error => {
			log.debug( {
				app: 'database',
				action: 'connect',
				message: 'Error connecting to Mongo database',
				error: error
			} );
			process.exit();
		} );
	});

	if (dbConfig) {
		try {
			await createConnection({
				...dbConfig,
				entities: [
					Notice,
					JoinFlow
				],
				synchronize: true
			});
			log.debug( {
				app: 'database',
				action: 'connect',
				message: 'Connected to database'
			} );
		} catch (error) {
			log.error({
				app: 'database',
				action: 'connect',
				message: 'Error connecting to database',
				error
			});
		}
	}
}

export async function close(): Promise<void> {
	await mongoose.disconnect();
	try {
		await getConnection().close();
	} catch (error) { 
		// TODO: remove once typeorm connection always open
	}
}

export { model as Exports } from '@models/exports';
export { model as GiftFlows } from '@models/gift-flows';
export { model as Members } from '@models/members';
export { model as Options } from '@models/options';
export { model as PageSettings } from '@models/page-settings';
export { model as Payments } from '@models/payments';
export { model as Permissions } from '@models/permissions';
export { model as PollAnswers } from '@models/PollAnswers';
export { model as Polls } from '@models/polls';
export { model as ProjectMembers } from '@models/project-members';
export { model as Projects } from '@models/projects';
export { model as ReferralGifts } from '@models/referral-gifts';
export { model as Referrals } from '@models/referrals';
export { model as RestartFlows } from '@models/restart-flows';
export { model as SpecialUrlGroups } from '@models/special-url-groups';
export { model as SpecialUrls } from '@models/special-urls';
export { model as TransactionalEmails } from '@models/transactional-emails';

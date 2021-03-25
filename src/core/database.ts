import 'reflect-metadata';

import mongoose from 'mongoose';
import { createConnection, getConnection } from 'typeorm';

import { log } from '@core/logging';

import OptionsService from '@core/services/OptionsService';

export async function connect( mongoUrl: string ): Promise<void> {
	await new Promise<void>(resolve => {
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
			log.error( {
				app: 'database',
				action: 'connect',
				message: 'Error connecting to Mongo database',
				error: error
			} );
			process.exit();
		} );
	});

	try {
		await createConnection();
		log.debug( {
			app: 'database',
			action: 'connect',
			message: 'Connected to database'
		} );
		await OptionsService.reload();
	} catch (error) {
		log.error({
			app: 'database',
			action: 'connect',
			message: 'Error connecting to database',
			error
		});
	}
}

export async function close(): Promise<void> {
	await mongoose.disconnect();
	await getConnection().close();
}

export { model as SpecialUrlGroups } from '@models/special-url-groups';
export { model as SpecialUrls } from '@models/special-urls';

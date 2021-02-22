import 'reflect-metadata';

import mongoose from 'mongoose';
import { createConnection, getConnection, ConnectionOptions } from 'typeorm';

import { log } from '@core/logging';

import OptionsService from '@core/services/OptionsService';

import Email from '@models/Email';
import EmailMailing from '@models/EmailMailing';
import Export from '@models/Export';
import ExportItem from '@models/ExportItem';
import GCPayment from '@models/GCPayment';
import GCPaymentData from '@models/GCPaymentData';
import GiftFlow from '@models/GiftFlow';
import JoinFlow from '@models/JoinFlow';
import ManualPaymentData from '@models/ManualPaymentData';
import Notice from '@models/Notice';
import Option from '@models/Option';
import PageSettings from '@models/PageSettings';
import Poll from '@models/Poll';
import PollResponse from '@models/PollResponse';
import Project from '@models/Project';
import ProjectEngagement from '@models/ProjectEngagement';
import ProjectMember from '@models/ProjectMember';
import Referral from '@models/Referral';
import ReferralGift from '@models/ReferralGift';
import RestartFlow from '@models/RestartFlow';
import Segment from '@models/Segment';
import SegmentOngoingEmail from '@models/SegmentOngoingEmail';
import SegmentMember from '@models/SegmentMember';
import MemberPermission from '@models/MemberPermission';

export async function connect( mongoUrl: string, dbConfig: ConnectionOptions ): Promise<void> {
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
		await createConnection({
			...dbConfig,
			entities: [
				Email, EmailMailing, Export, ExportItem, GiftFlow, GCPayment,
				GCPaymentData, JoinFlow, ManualPaymentData, MemberPermission, Notice,
				Option, PageSettings, Poll, PollResponse, Project, ProjectMember,
				ProjectEngagement, Referral, ReferralGift, RestartFlow, Segment,
				SegmentOngoingEmail, SegmentMember
			]
		});
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

export { model as Members } from '@models/members';
export { model as SpecialUrlGroups } from '@models/special-url-groups';
export { model as SpecialUrls } from '@models/special-urls';

import crypto from 'crypto';
import { createQueryBuilder, EntityTarget, getRepository, SelectQueryBuilder } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Chance } from 'chance';

import Email from '@models/Email';
import EmailMailing from '@models/EmailMailing';
import Export from '@models/Export';
import ExportItem from '@models/ExportItem';
import GCPayment from '@models/GCPayment';
import GCPaymentData from '@models/GCPaymentData';
import GiftFlow, { GiftForm } from '@models/GiftFlow';
import ManualPaymentData from '@models/ManualPaymentData';
import Member from '@models/Member';
import MemberPermission from '@models/MemberPermission';
import MemberProfile from '@models/MemberProfile';
import Notice from '@models/Notice';
import Option from '@models/Option';
import PageSettings from '@models/PageSettings';
import Poll from '@models/Poll';
import PollResponse from '@models/PollResponse';
import Project from '@models/Project';
import ProjectMember from '@models/ProjectMember';
import ProjectEngagement from '@models/ProjectEngagement';
import Referral from '@models/Referral';
import ReferralGift from '@models/ReferralGift';
import RestartFlow from '@models/RestartFlow';
import Segment from '@models/Segment';
import SegmentMember from '@models/SegmentMember';
import SegmentOngoingEmail from '@models/SegmentOngoingEmail';

type DrierMap<T> = {[K in keyof T]?: ((prop: T[K]) => T[K])|Drier<T[K]>};

export interface Drier<T> {
	model: EntityTarget<T>
	propMap: DrierMap<T>
}

function createDrier<T>(model: EntityTarget<T>, propMap: DrierMap<T> = {}): Drier<T> {
	return {model, propMap};
}

// Property generators

function copy<T>(a: T): T {
	return a;
}

function randomId(len: number, prefix?: string) {
	return () => (prefix || '') + crypto.randomBytes(6).toString('hex').slice(0, len).toUpperCase();
}

let codeNo = 0;
function uniqueCode(): string {
	codeNo++;
	const letter = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'[Math.floor(codeNo / 1000)];
	const no = codeNo % 1000;
	return letter.padStart(2, 'A') + (no + '').padStart(3, '0');
}

// Relations are loaded with loadRelationIds
const memberId = () => uuidv4() as unknown as Member;

const chance = new Chance();

// Model driers

const emailDrier = createDrier(Email);

const emailMailingDrier = createDrier(EmailMailing, {
	recipients: () => []
});

const exportsDrier = createDrier(Export);

const exportItemsDrier = createDrier(ExportItem, {
	itemId: copy // These will be mapped to values that have already been seen
});

export const gcPaymentsDrier = createDrier(GCPayment, {
	id: () => uuidv4(),
	paymentId: randomId(12, 'PM'),
	subscriptionId: randomId(12, 'SB'),
	member: memberId
});

export const gcPaymentDataDrier = createDrier(GCPaymentData, {
	member: memberId,
	customerId: randomId(12, 'CU'),
	mandateId: randomId(12, 'MD'),
	subscriptionId: randomId(12, 'SB')
});

const giftFlowDrier = createDrier(GiftFlow, {
	id: () => uuidv4(),
	setupCode: uniqueCode,
	sessionId: randomId(12),
	giftForm: createDrier(GiftForm, {
		firstname: () => chance.first(),
		lastname: () => chance.last(),
		email: () => chance.email({domain: 'fake.beabee.io', length: 10}),
		message: () => chance.sentence(),
		fromName: () => chance.name(),
		fromEmail: () => chance.email({domain: 'fake.beabee.io', length: 10}),
	}),
	giftee: memberId
});

export const manualPaymentDataDrier = createDrier(ManualPaymentData, {
	member: memberId,
	source: () => chance.pickone(['Standing order', 'Cash in hand']),
	reference: () => chance.word()
});

export const memberDrier = createDrier(Member, {
	id: () => uuidv4(),
	email: () => chance.email({domain: 'fake.beabee.io', length: 10}),
	firstname: () => chance.first(),
	lastname: () => chance.last(),
	otp: () => ({activated: false}),
	password: () => ({hash: '', salt: '', iterations: 0, tries: 0}),
	pollsCode: uniqueCode,
	referralCode: uniqueCode
});

export const memberPermissionDrier = createDrier(MemberPermission, {
	member: memberId
});

export const memberProfileDrier = createDrier(MemberProfile, {
	member: memberId,
	description: () => chance.sentence(),
	bio: () => chance.paragraph(),
	notes: () => chance.sentence(),
	telephone: () => chance.phone(),
	twitter: () => chance.twitter(),
	deliveryAddress: () => ({
		line1: chance.address(),
		line2: chance.pickone(['Cabot', 'Easton', 'Southmead', 'Hanham']),
		city: 'Bristol',
		postcode: 'BS1 1AA',
	}),
	tags: tags => tags.map(() => chance.profession())
});

const noticesDrier = createDrier(Notice);

const optionsDrier = createDrier(Option);

const pageSettingsDrier = createDrier(PageSettings);

const pollsDrier = createDrier(Poll);

const pollResponsesDrier = createDrier(PollResponse, {
	id: () => uuidv4(),
	member: memberId,
	guestName: () => chance.name(),
	guestEmail: () => chance.email({domain: 'example.com', length: 10})
});

const projectsDrier = createDrier(Project, {
	owner: memberId
});

const projectMembersDrier = createDrier(ProjectMember, {
	id: () => uuidv4(),
	member: memberId,
	tag: () => chance.profession(),
});

const projectEngagmentsDrier = createDrier(ProjectEngagement, {
	id: () => uuidv4(),
	byMember: memberId,
	toMember: memberId,
	notes: () => chance.sentence()
});

const referralsDrier = createDrier(Referral, {
	id: () => uuidv4(),
	referrer: memberId,
	referee: memberId
});

const referralsGiftDrier = createDrier(ReferralGift, {
	stock: copy // Add to map so it is serialised correctly
});

const restartFlowDrier = createDrier(RestartFlow, {
	id: () => uuidv4(),
	member: memberId
});

const segmentsDrier = createDrier(Segment);

const segmentMembersDrier = createDrier(SegmentMember, {
	member: memberId
});

const segmentOngoingEmailsDrier = createDrier(SegmentOngoingEmail);

// Order these so they respect foreign key constraints
export default [
	memberDrier, // A lot of relations depend on members so leave it first
	memberPermissionDrier,
	memberProfileDrier,
	emailDrier,
	emailMailingDrier,
	exportsDrier,
	gcPaymentDataDrier,
	giftFlowDrier,
	manualPaymentDataDrier,
	noticesDrier,
	optionsDrier,
	gcPaymentsDrier,
	pageSettingsDrier,
	pollsDrier, // Must be before pollResponsesDrier
	pollResponsesDrier,
	projectsDrier,
	projectMembersDrier,
	projectEngagmentsDrier,
	referralsGiftDrier, // Must be before referralsDrier
	referralsDrier,
	restartFlowDrier,
	segmentsDrier,
	segmentMembersDrier,
	segmentOngoingEmailsDrier,
	exportItemsDrier // Must be after all exportable items
] as Drier<any>[];

function isDrier<T>(propMap: DrierMap<T>[keyof T]): propMap is Drier<T[keyof T]> {
	return 'propMap' in propMap;
}

// Maps don't stringify well
function stringify(value: any): string {
	return JSON.stringify(value, (key: string, value: any): any => {
		return value instanceof Map ? [...value] : value;
	});
}

function runDrier<T>(item: T, drier: Drier<T>, valueMap: Map<string, unknown>): T {
	const newItem = Object.assign({}, item);

	for (const _prop of Object.keys(drier.propMap)) {
		const prop = _prop as keyof T;
		const propMap = drier.propMap[prop];
		const oldValue = item[prop];
		if (oldValue && propMap) {
			const valueKey = stringify(oldValue);

			const newValue = isDrier(propMap) ? runDrier(oldValue, propMap, valueMap) :
				valueMap.get(valueKey) || propMap(oldValue);

			valueMap.set(valueKey, newValue);
			newItem[prop] = newValue as T[keyof T];
		}
	}

	return newItem;
}

export async function runExport<T>(drier: Drier<T>, fn: (qb: SelectQueryBuilder<T>) => SelectQueryBuilder<T>, valueMap: Map<string, unknown>): Promise<void> {
	console.error(`Anonymising ${getRepository(drier.model).metadata.tableName}`);

	for (let i = 0; ; i += 1000) {
		const items = await fn(createQueryBuilder(drier.model, 'item'))
			.loadAllRelationIds().offset(i).limit(1000).getMany();

		if (items.length === 0) {
			break;
		}

		const newItems = items.map(item => runDrier(item, drier, valueMap));

		const [query, params] = createQueryBuilder()
			.insert().into(drier.model).values(newItems).getQueryAndParameters();

		console.log(query + ';');
		console.log(stringify(params));
	}
}

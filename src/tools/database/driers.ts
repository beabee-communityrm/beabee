import crypto from 'crypto';
import { EntityTarget } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Chance } from 'chance';

import Email from '@models/Email';
import Export from '@models/Export';
import ExportItem from '@models/ExportItem';
import GCPayment from '@models/GCPayment';
import GCPaymentData from '@models/GCPaymentData';
import GiftFlow, { GiftForm } from '@models/GiftFlow';
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
import ManualPaymentData from '@models/ManualPaymentData';
import EmailMailing from '@models/EmailMailing';
import Segment from '@models/Segment';
import SegmentMember from '@models/SegmentMember';
import SegmentOngoingEmail from '@models/SegmentOngoingEmail';

export type DrierMap<T> = {[K in WritableKeysOf<T>]?: ((prop: T[K]) => T[K])|Drier<T[K]>};

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

const gcPaymentsDrier = createDrier(GCPayment, {
	id: () => uuidv4(),
	paymentId: randomId(12, 'PM'),
	subscriptionId: randomId(12, 'SB'),
	member: memberId
});

const gcPaymentDataDrier = createDrier(GCPaymentData, {
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
		email: () => chance.email({domain: 'example.com', length: 10}),
		message: () => chance.sentence(),
		fromName: () => chance.name(),
		fromEmail: () => chance.email({domain: 'example.com', length: 10}),
	}),
	giftee: memberId
});

const manualPaymentDataDrier = createDrier(ManualPaymentData, {
	member: memberId,
	source: () => chance.pickone(['Standing order', 'Cash in hand']),
	reference: () => chance.word()
});

const memberDrier = createDrier(Member, {
	id: () => uuidv4(),
	email: () => chance.email({domain: 'example.com', length: 10}),
	firstname: () => chance.first(),
	lastname: () => chance.last(),
	otp: () => ({activated: false}),
	password: () => ({hash: '', salt: '', iterations: 0, tries: 0}),
	pollsCode: uniqueCode,
	referralCode: uniqueCode
});

const memberPermissionDrier = createDrier(MemberPermission, {
	member: memberId
});

const memberProfileDrier = createDrier(MemberProfile, {
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
	member: memberId
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
	segmentsDrier,
	segmentMembersDrier,
	segmentOngoingEmailsDrier,
	exportItemsDrier // Must be after all exportable items
] as Drier<any>[];

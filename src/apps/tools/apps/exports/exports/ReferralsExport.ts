import { createQueryBuilder, SelectQueryBuilder } from 'typeorm';

import Member from '@models/Member';
import Referral from '@models/Referral';

import BaseExport, { ExportResult } from './BaseExport';

function memberDetails(member?: Member) {
	return member ? [
		member.email,
		member.firstname,
		member.lastname,
		...member.profile.deliveryOptIn && member.profile.deliveryAddress ? [
			member.profile.deliveryAddress.line1,
			member.profile.deliveryAddress.line2,
			member.profile.deliveryAddress.city,
			member.profile.deliveryAddress.postcode
		] : ['', '', '', '']
	] : ['', '', '', '', '', '', ''];
}

export default class ReferralsExport extends BaseExport<Referral> {
	exportName = 'Referrals export'
	itemName = 'referrals'
	itemStatuses = ['added', 'seen']
	idColumn = 'r.id';

	protected get query(): SelectQueryBuilder<Referral> {
		return createQueryBuilder(Referral, 'r')
			.leftJoinAndSelect('r.referrer', 'referrer')
			.leftJoinAndSelect('r.referee', 'referee')
			.leftJoinAndSelect('referrer.profile', 'p1')
			.leftJoinAndSelect('referee.profile', 'p2')
			.orderBy('r.date');
	}

	async getExport(referrals: Referral[]): Promise<ExportResult> {
		const giftOptions = referrals
			.map(referral => [
				...Object.keys(referral.referrerGiftOptions || {}),
				...Object.keys(referral.refereeGiftOptions || {})
			])
			.reduce((a, b) => [...a, ...b], [])
			.filter((opt, i, arr) => arr.indexOf(opt) === i); // deduplicate

		const fields = [
			'Date', 'Type', 'Email', 'FirstName', 'LastName', 'Address1',
			'Address2', 'City', 'Postcode', 'RefereeAmount', 'Gift',
			...giftOptions
		];

		const data = referrals
			.map(referral => {
				const referrer = referral.referrer;
				const referee = referral.referee;

				return [[
					referral.date.toISOString(),
					'Referrer',
					...memberDetails(referrer),
					referral.refereeAmount,
					referral.referrerGift,
					...giftOptions.map(opt => (referral.referrerGiftOptions || {[opt]: ''})[opt])
				], [
					referral.date.toISOString(),
					'Referee',
					...memberDetails(referee),
					referral.refereeAmount,
					referral.refereeGift,
					...giftOptions.map(opt => (referral.refereeGiftOptions || {[opt]: ''})[opt])
				]];
			})
			.reduce((a, b) => [...a, ...b], []);

		return {fields, data};
	}
}

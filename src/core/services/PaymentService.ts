import { ContributionType } from '@core/utils';
import GCPaymentData from '@models/GCPaymentData';
import ManualPaymentData from '@models/ManualPaymentData';
import { Member } from '@models/members';
import { getRepository } from 'typeorm';
import GCPaymentService from './GCPaymentService';

export default class PaymentService {
	static async getPaymentData(member: Member): Promise<GCPaymentData|ManualPaymentData|undefined> {
		switch (member.contributionType) {
		case ContributionType.GoCardless:
			return await GCPaymentService.getPaymentData(member);
		case ContributionType.Manual:
			return await getRepository(ManualPaymentData).findOne(member.id);
		}
	}
}

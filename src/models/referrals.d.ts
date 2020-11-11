import { Document } from 'mongoose';

interface ReferralGiftOptions {
    name: string,
    values: string[]
}

interface ReferralGift extends Document {
    name: string,
    label: string,
    description: string,
    minAmount: number,
    enabled: boolean,
	options: ReferralGiftOptions,
	stock?: Map<string, number>
}
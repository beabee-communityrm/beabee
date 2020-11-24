import { Document, Model, Types } from 'mongoose';

interface GiftFlow extends Document {
    date: Date,
    sessionId: string,
    member?: Types.ObjectId,
    setupCode: string,
    giftForm: {
        firstname: string,
        lastname: string,
        email: string,
        startDate: Date,
        message?: string,
        fromName: string,
        fromEmail: string,
        type: string,
        delivery_address?: {
            line1: string,
            line2: string,
            city: string,
            postcode: string
        },
        delivery_copies_address?: {
            line1: string,
            line2: string,
            city: string,
            postcode: string
        }
    },
    completed: boolean,
    processed: boolean
}

export const model: Model<GiftFlow>;

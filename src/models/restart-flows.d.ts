import { Document, Model } from 'mongoose';
import { Member } from '@models/members';
import { JoinForm } from '@models/JoinFlow';

interface RestartFlow extends Document {
    member: Member;
    date?: Date;
    customerId: string;
    mandateId: string;
    joinForm: JoinForm;
}

export const model: Model<RestartFlow>;

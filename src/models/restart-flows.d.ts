import { Document, Model } from 'mongoose';
import { Member } from '@models/members';
import { JoinForm } from './join-flows';

interface RestartFlow extends Document {
    code: string;
    member: Member;
    date?: Date;
    customerId: string;
    mandateId: string;
    joinForm: JoinForm;
}

export const model: Model<RestartFlow>;

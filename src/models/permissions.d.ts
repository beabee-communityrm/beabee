import { Document, Model } from 'mongoose';

interface Permission extends Document {
    name: string
    slug: string
    description?: string
}

export const model: Model<Permission>;

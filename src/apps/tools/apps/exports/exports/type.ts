import { Param } from '@core/utils/params';
import Export from '@models/Export';
import { Document, Model } from 'mongoose';

export interface ExportType<T extends Document> {
	name: string
	statuses: string[]
	collection: Model<T>,
	itemName: string,
	getParams?(): Promise<Param[]>
	getQuery(ex: Export): Promise<any>
	getExport(items: T[], ex: Export): Promise<Record<string, any>[]>
}

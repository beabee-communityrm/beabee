import 'module-alias/register';

import { createQueryBuilder, getRepository } from 'typeorm';

import * as db from '@core/database';

import Member from '@models/Member';

import {
	Drier, gcPaymentDataDrier, gcPaymentsDrier, memberDrier,
	memberPermissionDrier, memberProfileDrier, pollResponsesDrier, pollsDrier,
	runExport
} from './driers';

async function main() {
	for (const drier of [pollResponsesDrier, pollsDrier, gcPaymentDataDrier, gcPaymentsDrier, memberProfileDrier, memberPermissionDrier, memberDrier] as Drier<any>[]) {
		console.log(`DELETE FROM "${getRepository(drier.model).metadata.tableName}";`);
		console.log();
	}

	const members = await createQueryBuilder(Member, 'm')
		.select('m.id').orderBy('random()').limit(400).getMany();

	const memberIds = members.map(m => m.id);

	const valueMap = new Map<string, unknown>();

	await runExport(memberDrier, qb => qb.where('item.id IN (:...ids)', {ids: memberIds}), valueMap);
	await runExport(memberPermissionDrier, qb => qb.where('item.memberId IN (:...ids)', {ids: memberIds}), valueMap);
	await runExport(memberProfileDrier, qb => qb.where('item.memberId IN (:...ids)', {ids: memberIds}), valueMap);
	await runExport(gcPaymentsDrier, qb => qb.where('item.memberId IN (:...ids)', {ids: memberIds}).orderBy('id'), valueMap);
	await runExport(gcPaymentDataDrier, qb => qb.where('item.memberId IN (:...ids)', {ids: memberIds}), valueMap);
	await runExport(pollsDrier, qb => qb.orderBy({date: 'DESC'}).limit(2), valueMap);
}

db.connect().then(async () => {
	try {
		await main();
	} catch (err) {
		console.error(err);
	}
	await db.close();
});

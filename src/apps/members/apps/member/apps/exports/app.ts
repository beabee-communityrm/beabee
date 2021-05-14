import express from 'express';
import { getRepository } from 'typeorm';

import { wrapAsync } from '@core/utils';

import ExportTypes from '@apps/tools/apps/exports/exports';

import ExportItem from '@models/ExportItem';
import Member from '@models/Member';

const app = express();

app.set( 'views', __dirname + '/views' );

app.get('/', wrapAsync(async (req, res) => {
	const member = req.model as Member;
	const exportItems = await getRepository(ExportItem).find({
		where: {itemId: member.id},
		relations: ['export']
	});

	const exportItemsWithTypes = exportItems
		.filter(item => !!ExportTypes[item.export.type])
		.map(item => ({
			...item,
			type: new ExportTypes[item.export.type]()
		}));

	res.render('index', {exportItems: exportItemsWithTypes, member});
}));

export default app;

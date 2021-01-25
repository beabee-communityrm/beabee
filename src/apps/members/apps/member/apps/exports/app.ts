import express from 'express';

import { wrapAsync } from '@core/utils';

import { Members } from '@core/database';
import { getRepository } from 'typeorm';
import Export from '@models/Export';

import exportTypes from '@apps/tools/apps/exports/exports';
import { Member } from '@models/members';
import ExportItem from '@models/ExportItem';

const app = express();

app.set( 'views', __dirname + '/views' );

app.get( '/', wrapAsync( async ( req, res ) => {
	const member = req.model as Member;

	// Only show member-based exports
	const exports = (await getRepository(Export).find()).filter(exportDetails => (
		exportTypes[exportDetails.type].collection === Members
	));

	res.render('index', {member, exports, exportTypes});
} ) );

app.post( '/', wrapAsync( async ( req, res ) => {
	if (req.body.action === 'update') {
		// TODO: use new ExportItem
		req.flash('success', 'exports-updated');

	} else if (req.body.action === 'add') {
		const exportDetails = await getRepository(Export).findOne(req.body.export_id);
		if (exportDetails) {
			const exportType = exportTypes[exportDetails.type];

			// Check member is eligible
			const member = await Members.findOne( {
				...await exportType.getQuery(exportDetails),
				exports: {$not: {$elemMatch: {
					export_id: exportDetails
				}}},
				uuid: req.params.uuid
			} );

			if (member) {
				const exportItem = new ExportItem();
				exportItem.export = exportDetails;
				exportItem.itemId = member.id;
				exportItem.status = exportType.statuses[0];
				await getRepository(ExportItem).insert(exportItem);

				req.flash( 'success', 'exports-added-one' );
			} else {
				req.flash( 'error', 'exports-ineligible' );
			}
		} else {
			req.flash( 'error', 'exports-ineligible' );
		}
	}

	res.redirect( req.url );
} ) );

export default app;
